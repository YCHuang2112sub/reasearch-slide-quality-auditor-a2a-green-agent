import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { AuditResult, ModelType, SlideData } from "../types/audit";

export class AuditorService {
    private genAI: GoogleGenerativeAI;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    async auditSlide(
        slideImageBase64: string,
        layoutSchematic: string,
        slideData: SlideData,
        storyContext: string,
        model: ModelType = 'gemini-1.5-flash-latest'
    ): Promise<AuditResult> {
        // Use v1beta explicitly if needed, but SDK usually handles it.
        // gemini-1.5-flash is supported in v1beta for structured output.
        const generativeModel = this.genAI.getGenerativeModel({
            model: model,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        explicitDescription: { type: SchemaType.STRING },
                        r2n_retention: { type: SchemaType.INTEGER },
                        r2n_authenticity: { type: SchemaType.INTEGER },
                        r2n_risk: { type: SchemaType.INTEGER },
                        r2s_retention: { type: SchemaType.INTEGER },
                        r2s_authenticity: { type: SchemaType.INTEGER },
                        r2s_risk: { type: SchemaType.INTEGER },
                        n2s_retention: { type: SchemaType.INTEGER },
                        n2s_authenticity: { type: SchemaType.INTEGER },
                        n2s_risk: { type: SchemaType.INTEGER },
                        clarityScore: { type: SchemaType.INTEGER },
                        logicScore: { type: SchemaType.INTEGER },
                        visualDensity: { type: SchemaType.STRING },
                        focalPoint: { type: SchemaType.STRING },
                        internalAlignment: { type: SchemaType.INTEGER },
                        narrativeFlow: { type: SchemaType.INTEGER },
                        totalScore: { type: SchemaType.INTEGER },
                        narrativeVerdict: { type: SchemaType.STRING },
                        critique: { type: SchemaType.STRING }
                    },
                    required: [
                        "explicitDescription", "r2n_retention", "r2n_authenticity", "r2n_risk",
                        "r2s_retention", "r2s_authenticity", "r2s_risk",
                        "n2s_retention", "n2s_authenticity", "n2s_risk",
                        "clarityScore", "logicScore", "visualDensity", "focalPoint", "internalAlignment", "narrativeFlow", "totalScore", "narrativeVerdict", "critique"
                    ]
                }
            }
        });

        const prompt = `You are a Senior Strategy Consultant (McKinsey/Bain style). Evaluate this slide against the research plan.
                
STORY CONTEXT (Previous Slide Summary):
"${storyContext}"

LAYOUT SCHEMATIC (Text Coordinates):
${layoutSchematic}

RESEARCH PLAN/FINDINGS FOR THIS SLIDE:
${JSON.stringify(slideData)}

---
---
YOUR MANDATORY FORENSIC WORKFLOW:

STEP 0: ATOMIZATION & STRATEGIC BASELINING
1. ATOMIZE: Break down the provided Research 'Findings' into a discrete numbered list of "Atomic Claims" (the smallest possible verifiable points).
2. BASELINE: Assess the strategic tone of the source (certainty, nuances, constraints).
3. STRETCH TEST: Specifically look for "Strategic Stretching"—where the target (Slide/Notes) amplifies, oversells, or absolute-izes a probabilistic or constrained finding.

STEP 1: EXPLICIT SLIDE DESCRIPTION
Provide a rigorous, detailed description of every visual and textual element on this slide based on the image and layout schematic.

STEP 2: 3x3 FIDELITY AUDIT
Evaluate 3 paths (Research->Notes, Research->Slide, Notes->Slide) across 3 criteria:
1. RETENTION: % of source Atomic Claims successfully captured in target.
2. AUTHENTICITY: Accuracy of captured info (flagging any Strategic Stretching).
3. HALLUCINATION RISK: Penalty points for info added in target with no parent Atomic Claim.

### RUBRICS (100 pts each):
- [R2N] Research -> Notes: Compare Atomic Claims to Speaker Notes.
- [R2S] Research -> Slide: Compare Atomic Claims to Visual/Text Layout.
- [N2S] Notes -> Slide: Compare Speaker Notes to Visual/Text Layout.

- CLARITY & LOGIC: Legibility (>16pt), focal point, and headline-body alignment.
- STORY FLOW: Verbal/Visual bridges and narrative progression.

OUTPUT JSON FORMAT ONLY.`;

        console.log(`[DEBUG] Sending audit request to Gemini for slide ${slideData.title || 'unknown'}...`);
        const result = await generativeModel.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: "image/jpeg",
                    data: slideImageBase64
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();
        console.log("[DEBUG] Received Gemini response text length:", text.length);

        try {
            return JSON.parse(text);
        } catch (e) {
            console.error("[DEBUG] Failed to parse Gemini response as JSON. Raw text:", text);
            throw e;
        }
    }
}

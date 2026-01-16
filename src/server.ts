import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import { AuditorService } from './services/auditor';
import { PDFProcessor } from './utils/pdfProcessor';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '20mb' })); // Increased limit for large PDFs (6MB base64 = ~8MB)
app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));

process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Basic argument parsing
console.log('[STARTUP] Parsing command line arguments:', process.argv);
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const hostArg = args.indexOf('--host');

const PORT = portArg !== -1 ? parseInt(args[portArg + 1]) : (process.env.PORT ? parseInt(process.env.PORT) : 9009);
const HOST = hostArg !== -1 ? args[hostArg + 1] : '0.0.0.0';
console.log('[STARTUP] PORT configured as:', PORT);
console.log('[STARTUP] HOST configured as:', HOST);

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || '';

const auditor = new AuditorService(API_KEY);
const pdfProcessor = new PDFProcessor();

/**
 * A2A Agent Card Endpoint
 */
const getAgentCard = () => ({
    name: "Research Slide Quality Auditor",
    description: "A sophisticated Multimodal Green Agent designed to audit the consistency and authenticity of research-based slide decks. It evaluates the relationship between research findings, speaker notes, and visual slide content to identify hallucinations and ensure data integrity.",
    version: "1.0.0",
    type: "green",
    capabilities: {
        assessment: {
            type: "assessment",
            description: "Audits slide fidelity against research"
        }
    },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: [],
    url: "http://green-agent:9009",
    endpoints: {
        assess: "/assess"
    }
});

app.get('/', (req, res) => {
    console.log('[REQUEST] GET / - Sending agent card');
    res.json(getAgentCard());
});

app.get('/.well-known/agent-card.json', (req, res) => {
    console.log('[REQUEST] GET /.well-known/agent-card.json - Sending agent card');
    res.json(getAgentCard());
});

/**
 * A2A Assessment Endpoint
 */
app.post(['/', '/assess'], async (req, res) => {
    console.log("\n[REQUEST] POST /assess - New Assessment Request");
    console.log('[DEBUG] Request body keys:', Object.keys(req.body));
    const params = req.body.params || {};

    let { participants, config } = req.body;

    // ADAPTATION FOR AGENTBEATS PROTOCOL WRAPPER
    // The client sends the payload inside params.message.parts[0].text as a JSON string
    if (!participants && req.body.params?.message?.parts?.[0]?.text) {
        try {
            console.log("[ANTIGRAVITY] Detected AgentBeats Message Wrapper. Attempting to unwrap...");
            const innerData = JSON.parse(req.body.params.message.parts[0].text);
            if (innerData.participants) {
                participants = innerData.participants;
                config = innerData.config;
                console.log("[ANTIGRAVITY] Successfully unwrapped payload.");
                // Successfully unwrapped. We now have participants and config.
                // Fall through to the main logic to orchestrate the assessment.
            }
        } catch (e) {
            console.error("[ANTIGRAVITY] Failed to unwrap AgentBeats Message:", e);
        }
    }



    if (!participants) {
        console.error("Participants not found in request body (even after unwrap attempt)");
        return res.status(400).json({ error: "Missing participants" });
    }

    console.log("[DEBUG] Participants:", JSON.stringify(participants, null, 2));
    console.log("[DEBUG] Config:", JSON.stringify(config, null, 2));

    let slideGeneratorUrl = "http://agent:9009"; // Default
    if (Array.isArray(participants)) {
        const agent = participants.find((p: any) => p.name === 'agent');
        if (agent && agent.url) slideGeneratorUrl = agent.url;
        // Also check for env var based discovery if needed
    } else if (participants?.slide_generator) {
        slideGeneratorUrl = participants.slide_generator;
    }

    console.log(`[DEBUG] Resolved Slide Generator URL: ${slideGeneratorUrl}`);

    const researchData = config.research_data;

    try {
        // 1. Request Slide Generation from Purple Agent
        console.log(`[DEBUG] Requesting slide generation from purple agent at: ${slideGeneratorUrl}/generate`);
        // Log the payload we are sending
        console.log(`[DEBUG] Payload sent to Purple Agent:`, JSON.stringify({ input: researchData }, null, 2));

        let genResponse;
        try {
            genResponse = await axios.post(`${slideGeneratorUrl}/generate`, {
                input: researchData
            });
            console.log(`[DEBUG] Purple Agent Response Status: ${genResponse.status}`);
            console.log(`[DEBUG] Purple Agent Response Headers:`, JSON.stringify(genResponse.headers));
            // console.log(`[DEBUG] Purple Agent Response Data Keys:`, Object.keys(genResponse.data)); // Summarize
        } catch (axiosError: any) {
            console.error(`[ERROR] Purple Agent Request Failed: ${axiosError.message}`);
            if (axiosError.response) {
                console.error(`[ERROR] Response Status: ${axiosError.response.status}`);
                console.error(`[ERROR] Response Data:`, JSON.stringify(axiosError.response.data));
            }
            throw axiosError; // Re-throw to be caught by outer handler
        }

        // ... (Processing logic remains the same) ...
        const pdfBase64 = genResponse.data.pdf;

        // DEBUG: Save received files to volume for verification
        try {
            const fs = await import('fs');
            if (!fs.existsSync('/app/debug_output')) fs.mkdirSync('/app/debug_output', { recursive: true });

            fs.writeFileSync('/app/debug_output/green_received.pdf', Buffer.from(pdfBase64, 'base64'));
            if (genResponse.data.json) {
                fs.writeFileSync('/app/debug_output/green_received.json', JSON.stringify(genResponse.data.json, null, 2));
            }
            console.log('[DEBUG] Saved green_received.pdf and .json to /app/debug_output');
        } catch (debugErr) {
            console.error('[DEBUG] Failed to save debug files:', debugErr);
        }
        if (!pdfBase64) {
            throw new Error("No PDF data returned from purple agent");
        }
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const pages = await pdfProcessor.processPDF(pdfBuffer);

        // Save first page image for inspection
        if (pages.length > 0) {
            try {
                const fs = await import('fs');
                if (!fs.existsSync('/app/debug_output')) fs.mkdirSync('/app/debug_output', { recursive: true });
                fs.writeFileSync('/app/debug_output/green_page1_preview.png', Buffer.from(pages[0].image, 'base64'));
                console.log('[DEBUG] Saved green_page1_preview.png to /app/debug_output');
            } catch (e) { console.error('[DEBUG] Failed to save preview image:', e); }
        }

        const auditResults = [];
        let storyContext = "Initial Slide: No previous context.";

        for (let i = 0; i < pages.length; i++) {
            if (i > 0) await new Promise(r => setTimeout(r, 5000)); // Rate limiting
            const page = pages[i];
            // Use generated slides from Purple Agent if available, otherwise fallback to input plan
            const generatedSlides = genResponse.data?.json?.slides || [];
            const slideData = generatedSlides[i] || researchData.slides?.[i] || researchData;
            const result = await auditor.auditSlide(page.image, page.text, slideData, storyContext);
            auditResults.push(result);
            storyContext = `Slide ${i + 1} Verdict: ${result.narrativeVerdict}`;
        }

        // 4. Return Results
        // Wrap in AgentBeats A2A envelope to satisfy strict clients
        // 4. Return Results
        // Wrap in JSON-RPC envelope if request was JSON-RPC
        const isJsonRpc = req.body.jsonrpc === "2.0";
        const requestId = req.body.id || null;

        // Construct a flat Message object satisfying the schema
        const resultPayload = {
            role: "agent",
            messageId: params.messageId || ("msg-" + Date.now()), // Echo ID or generate new
            parts: [
                {
                    text: JSON.stringify(auditResults)
                }
            ]
        };

        // DEBUG: Save final audit result
        try {
            const fs = await import('fs');
            fs.writeFileSync('/app/debug_output/green_audit_result.json', JSON.stringify(resultPayload, null, 2));
            console.log('[DEBUG] Saved green_audit_result.json');

            // --- LEADERBOARD COMPATIBILITY ---
            // Also save the authoritative 'results.json' with the 'run_id' field 
            // so it can be directly picked up by the leaderboard without extra scripts.
            let agentIdKey = "unknown_agent";
            if (Array.isArray(participants)) {
                const pAgent = participants.find((p: any) => p.name === 'agent');
                if (pAgent && pAgent.agentbeats_id) agentIdKey = pAgent.agentbeats_id;
                else if (pAgent && pAgent.id) agentIdKey = pAgent.id;
            } else if (participants?.agent) {
                agentIdKey = participants.agent;
            }

            const leaderboardPayload = {
                participants: {
                    agent: agentIdKey,
                    run_id: "run-" + Date.now() + "-" + Math.floor(Math.random() * 1000)
                },
                results: auditResults
            };
            fs.writeFileSync('/app/debug_output/results.json', JSON.stringify(leaderboardPayload, null, 2));
            console.log('[DEBUG] Saved standardized results.json with run_id to /app/debug_output');
            // ----------------------------------

        } catch (e) { console.error('Failed to save audit result:', e); }

        console.log("DEBUG: Sending Result Payload (Message Schema):", JSON.stringify(resultPayload, null, 2));

        if (isJsonRpc) {
            res.json({
                jsonrpc: "2.0",
                id: requestId,
                result: resultPayload
            });
        } else {
            // Legacy/Direct support
            res.json({
                status: "completed",
                result: resultPayload,
                artifacts: [
                    {
                        id: "audit-report",
                        totalScore: { type: "INTEGER", description: "Overall composite score 1-100. MUST NOT EXCEED 100. Average all metrics and normalize." },
                        type: "application/json",
                        data: auditResults
                    }
                ],
                ...auditResults
            });
        }


    } catch (error: any) {
        console.error("Assessment failed:", error);
        res.status(500).json({
            status: "failed",
            error: error.message
        });
    }
});

app.listen(PORT, HOST, () => {
    console.log(`[STARTUP] Green Agent listening on ${HOST}:${PORT}`);
    console.log('[STARTUP] Healthcheck endpoint: /.well-known/agent-card.json');
    console.log('[STARTUP] Assessment endpoint: /assess');
});

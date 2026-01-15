import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// Initialize PDF.js worker
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface AuditResult {
  pageNumber: number;
  explicitDescription: string; // Explicitly detailed description of the slide content

  // 3x3 Matrix: [Retention, Authenticity, Hallucination]
  // R2N: Research -> Notes
  r2n_retention: number; r2n_authenticity: number; r2n_risk: number;
  // R2S: Research -> Slide
  r2s_retention: number; r2s_authenticity: number; r2s_risk: number;
  // N2S: Notes -> Slide
  n2s_retention: number; n2s_authenticity: number; n2s_risk: number;

  clarityScore: number;       // Legibility audit
  logicScore: number;         // Headline-Body alignment
  visualDensity: string;      // Low/Medium/High
  focalPoint: string;         // What draws the eye first
  internalAlignment: number;  // Logic within the slide (1-100)
  narrativeFlow: number;      // Consistency with previous context (1-100)
  totalScore: number;
  narrativeVerdict: string;   // Qualitative summary
  critique: string;           // Strategic feedback
  layoutSchematic: string;    // Extracted metadata
}

// Updated to use the correct model aliases to avoid 404 NOT_FOUND errors
type ModelType = 'gemini-flash-lite-latest' | 'gemini-flash-latest';

const SlideDeckAuditor = () => {
  const [jsonFile, setJsonFile] = useState<any>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<AuditResult[]>([]);
  const [progress, setProgress] = useState("");
  const [currentAuditIndex, setCurrentAuditIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-flash-lite-latest');
  const [showInfo, setShowInfo] = useState(false);

  const aggregates = React.useMemo(() => {
    if (results.length === 0) return null;
    const count = results.length;
    return {
      r2n: Math.round(results.reduce((acc, r) => acc + (r.r2n_retention + r.r2n_authenticity + (100 - r.r2n_risk)) / 3, 0) / count),
      r2s: Math.round(results.reduce((acc, r) => acc + (r.r2s_retention + r.r2s_authenticity + (100 - r.r2s_risk)) / 3, 0) / count),
      n2s: Math.round(results.reduce((acc, r) => acc + (r.n2s_retention + r.n2s_authenticity + (100 - r.n2s_risk)) / 3, 0) / count),
      total: Math.round(results.reduce((acc, r) => acc + r.totalScore, 0) / count),
    };
  }, [results]);

  const onDrop = (e: React.DragEvent, type: 'json' | 'pdf') => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file, type);
  };

  const handleFile = async (file: File, type: 'json' | 'pdf') => {
    if (type === 'json') {
      const text = await file.text();
      try {
        setJsonFile(JSON.parse(text));
      } catch (e) {
        alert("Invalid JSON file");
      }
    } else {
      setPdfFile(file);
    }
  };

  const processAuditor = async () => {
    if (!jsonFile || !pdfFile) return;
    setIsProcessing(true);
    setResults([]);

    try {
      setProgress("Parsing PDF structure...");
      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const pages = pdf.numPages;
      setTotalPages(pages);

      let slideDefinitions: any[] = [];
      if (jsonFile.slides && Array.isArray(jsonFile.slides)) {
        slideDefinitions = jsonFile.slides;
      } else if (Array.isArray(jsonFile)) {
        slideDefinitions = jsonFile;
      } else {
        slideDefinitions = [jsonFile];
      }

      const newResults: AuditResult[] = [];
      let storyContext = "Initial Slide: No previous context.";

      for (let i = 1; i <= pages; i++) {
        setCurrentAuditIndex(i);
        setProgress(`Executing McKinsey-Style Audit: Slide ${i}/${pages}...`);

        const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY || '' });
        const page = await pdf.getPage(i);

        // 1. Extract Layout Information (Text Positions)
        const textContent = await page.getTextContent();
        const layoutSchematic = textContent.items
          .map((item: any) => `[Text: "${item.str}" at x:${Math.round(item.transform[4])}, y:${Math.round(item.transform[5])}]`)
          .join("\n");

        // 2. Render Page for Vision
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const maxDimension = 1024; // Increased for better OCR/layout vision
        const scale = maxDimension / Math.max(unscaledViewport.width, unscaledViewport.height);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error("Canvas context failed");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        const rawSpec = slideDefinitions[i - 1] || { title: "Untitled", researchPlan: "No plan findings found for this index.", findings: "" };

        // 3. Perform High-Fidelity Context-Aware Audit
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
              {
                text: `You are a Senior Strategy Consultant (McKinsey/Bain style). Evaluate this slide against the research plan.
                
STORY CONTEXT (Previous Slide Summary):
"${storyContext}"

LAYOUT SCHEMATIC (Text Coordinates):
${layoutSchematic}

RESEARCH PLAN/FINDINGS FOR THIS SLIDE:
${JSON.stringify(rawSpec)}

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

OUTPUT JSON FORMAT ONLY.` }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                explicitDescription: { type: Type.STRING, description: "Detailed textual breakdown of slide visuals/copy" },
                r2n_retention: { type: Type.INTEGER },
                r2n_authenticity: { type: Type.INTEGER },
                r2n_risk: { type: Type.INTEGER },
                r2s_retention: { type: Type.INTEGER },
                r2s_authenticity: { type: Type.INTEGER },
                r2s_risk: { type: Type.INTEGER },
                n2s_retention: { type: Type.INTEGER },
                n2s_authenticity: { type: Type.INTEGER },
                n2s_risk: { type: Type.INTEGER },
                clarityScore: { type: Type.INTEGER, description: "1-100" },
                logicScore: { type: Type.INTEGER, description: "1-100" },
                visualDensity: { type: Type.STRING },
                focalPoint: { type: Type.STRING },
                internalAlignment: { type: Type.INTEGER },
                narrativeFlow: { type: Type.INTEGER },
                totalScore: { type: Type.INTEGER },
                narrativeVerdict: { type: Type.STRING },
                critique: { type: Type.STRING }
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

        const auditData = JSON.parse(response.text || '{}');

        // All scores are now produced in 1-100 range by the weighted AI prompt
        const normalizedData = {
          ...auditData,
          pageNumber: i,
          layoutSchematic
        };

        newResults.push(normalizedData);
        setResults([...newResults]);

        // Update Story Context for next slide
        storyContext = `Slide ${i} Title: ${rawSpec.title || 'Untitled'}. Summary: ${auditData.narrativeVerdict}`;
      }
      setProgress("Full Storyboard Analysis Complete.");
    } catch (error: any) {
      console.error(error);
      alert(`Audit failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setCurrentAuditIndex(0);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto text-slate-200 relative">
      {/* Floating Info Button */}
      <button
        onClick={() => setShowInfo(true)}
        className="fixed bottom-12 right-12 w-16 h-16 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-full flex items-center justify-center text-2xl font-black shadow-2xl hover:scale-110 active:scale-95 transition-all z-[100] border border-white/20 group"
      >
        <span className="group-hover:rotate-12 transition-transform">?</span>
      </button>

      {/* Rubrics Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowInfo(false)} />
          <div className="glass max-w-2xl w-full max-h-[80vh] overflow-y-auto rounded-[3rem] border border-white/10 p-12 relative shadow-2xl animate-in zoom-in-95 backdrop-blur-2xl">
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"
            >
              ✕
            </button>
            <h2 className="text-4xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
              A2A Audit Rubrics
            </h2>
            <p className="text-slate-400 text-sm mb-10 leading-relaxed">
              Our auditor uses a weighted-point system to simulate a Senior Strategy Consultant's review.
            </p>

            <div className="space-y-10">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">🛡️ 3x3 Fidelity Matrix (9 Metrics)</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  We evaluate the 3 logic paths (Research-to-Notes, Research-to-Slide, Notes-to-Slide) across 3 dimensions:
                </p>
                <ul className="grid grid-cols-1 gap-3">
                  <li className="flex justify-between text-[13px] border-b border-white/5 pb-2"><span>Retention</span> <span className="text-slate-400 italic">% of Findings preserved</span></li>
                  <li className="flex justify-between text-[13px] border-b border-white/5 pb-2"><span>Authenticity</span> <span className="text-slate-400 italic">Accuracy & Tone fidelity</span></li>
                  <li className="flex justify-between text-[13px] border-b border-white/5 pb-2"><span>Creation Risk</span> <span className="text-slate-400 italic">Hallucination penalty</span></li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">📝 Atomic Audit Process</h3>
                <p className="text-[12px] text-slate-400 leading-relaxed italic border-l-2 border-emerald-500/30 pl-4">
                  "The AI first <strong>Atomizes</strong> the research into discrete claims and establishes a <strong>Strategic Baseline</strong>. It specifically tests for <strong>Strategic Stretching</strong>—overselling or absolute-izing constrained data—before performing the 3x3 matrix audit."
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400">🏛️ Logical Quality (Supplements)</h3>
                <ul className="grid grid-cols-2 gap-4">
                  <li className="text-[11px] text-slate-500"><strong>Clarity:</strong> Legibility & 5s Rule.</li>
                  <li className="text-[11px] text-slate-500"><strong>Logic:</strong> Headline-Body Match.</li>
                  <li className="text-[11px] text-slate-500"><strong>Flow:</strong> Narrative Bridges.</li>
                  <li className="text-[11px] text-slate-500"><strong>Internal:</strong> 0% In-slide errors.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="mb-12 text-center">
        <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-emerald-400 to-cyan-400 mb-2 tracking-tight">
          A2A Auditor
        </h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mb-8">
          Agent-Led Multimodal Evaluation Framework
        </p>

        <div className="flex flex-col items-center gap-6">
          <div className="flex p-1.5 bg-slate-900/90 rounded-2xl border border-white/5 shadow-2xl">
            <button
              onClick={() => setSelectedModel('gemini-flash-lite-latest')}
              className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedModel === 'gemini-flash-lite-latest' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Flash Lite (Rapid)
            </button>
            <button
              onClick={() => setSelectedModel('gemini-flash-latest')}
              className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedModel === 'gemini-flash-latest' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Flash (Standard)
            </button>
          </div>
        </div>
      </header>

      {/* Metrics Legend / Glossary */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
        {[
          {
            label: "Research -> Notes",
            desc: "Does the speaker note capture all research without invention?",
            icon: "🎙️"
          },
          {
            label: "Research -> Slide",
            desc: "Does the visual deck accurately represent the source findings?",
            icon: "🖼️"
          },
          {
            label: "Notes -> Slide",
            desc: "Is there perfect reciprocity between visuals and the talk track?",
            icon: "🔗"
          },
          {
            label: "3x3 Matrix Audit",
            desc: "9 points of cross-modal fidelity (Retention, Auth, Risk).",
            icon: "🔬"
          }
        ].map((m, i) => (
          <div key={i} className="glass p-5 rounded-3xl border border-white/5 group hover:border-indigo-500/30 transition-all">
            <div className="text-2xl mb-2">{m.icon}</div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-1">{m.label}</h3>
            <p className="text-[10px] text-slate-500 leading-tight">{m.desc}</p>
          </div>
        ))}
      </section>

      {/* Slide Navigation Bar */}
      {results.length > 0 && (
        <nav className="sticky top-6 z-50 mb-16 mx-auto w-fit glass p-2 rounded-2xl border border-white/10 flex gap-2 shadow-2xl backdrop-blur-xl">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => document.getElementById(`slide-${r.pageNumber}`)?.scrollIntoView({ behavior: 'smooth' })}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-indigo-600 text-[10px] font-black transition-all flex items-center justify-center border border-white/5"
            >
              {r.pageNumber}
            </button>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('active'); }}
          onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('active'); }}
          onDrop={(e) => { onDrop(e, 'json'); e.currentTarget.classList.remove('active'); }}
          className="drop-zone glass rounded-[2.5rem] p-12 flex flex-col items-center justify-center min-h-[220px] cursor-pointer group transition-all"
        >
          <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📄</div>
          <h3 className="font-black text-lg mb-1 tracking-tighter">Research JSON</h3>
          <p className="text-[9px] text-slate-500 uppercase tracking-[0.3em]">Drop source schematic</p>
          {jsonFile && <div className="mt-6 px-4 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full text-[9px] font-black border border-indigo-500/20 animate-pulse">SOURCE MOUNTED</div>}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('active'); }}
          onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('active'); }}
          onDrop={(e) => { onDrop(e, 'pdf'); e.currentTarget.classList.remove('active'); }}
          className="drop-zone glass rounded-[2.5rem] p-12 flex flex-col items-center justify-center min-h-[220px] cursor-pointer group transition-all"
        >
          <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📽️</div>
          <h3 className="font-black text-lg mb-1 tracking-tighter">Rendered Deck</h3>
          <p className="text-[9px] text-slate-500 uppercase tracking-[0.3em]">Drop PDF / PPTX Export</p>
          {pdfFile && <div className="mt-6 px-4 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full text-[9px] font-black border border-emerald-500/20 animate-pulse">VISUALS LOADED</div>}
        </div>
      </div>

      <div className="flex flex-col items-center mb-20">
        <button
          onClick={processAuditor}
          disabled={!jsonFile || !pdfFile || isProcessing}
          className={`px-16 py-6 rounded-3xl font-black text-[11px] tracking-[0.4em] uppercase transition-all shadow-2xl ${!jsonFile || !pdfFile || isProcessing
            ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
            : 'bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white hover:scale-[1.03] active:scale-95'
            }`}
        >
          {isProcessing ? "Executing A2A Workflow..." : "Launch Framework Audit"}
        </button>
        {isProcessing && (
          <div className="mt-12 w-full max-w-md">
            <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase mb-4 tracking-widest">
              <span>{progress}</span>
              <span className="text-emerald-400">{Math.round((currentAuditIndex / (results.length + 1)) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-cyan-500 rounded-full transition-all duration-700"
                style={{ width: `${(currentAuditIndex / (results.length + 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {aggregates && (
        <section className="mb-20 animate-in fade-in zoom-in duration-700">
          <div className="glass rounded-[3rem] p-12 border border-indigo-500/20 bg-indigo-500/5 shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="flex-1">
                <h2 className="text-4xl font-black tracking-tighter mb-2">Global Audit Summary</h2>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.4em]">Aggregated McKinsey Metrics</p>
              </div>

              <div className="flex flex-wrap justify-center gap-6">
                {[
                  { val: aggregates.r2n, label: "Research -> Notes", color: "indigo" },
                  { val: aggregates.r2s, label: "Research -> Slide", color: "emerald" },
                  { val: aggregates.n2s, label: "Notes -> Slide", color: "cyan" }
                ].map((score, i) => (
                  <div key={i} className="bg-slate-900/80 px-8 py-5 rounded-3xl border border-white/10 text-center min-w-[160px] shadow-xl">
                    <div className="text-[9px] uppercase tracking-widest text-slate-500 font-black mb-2">{score.label}</div>
                    <div className="text-3xl font-black text-slate-100">{score.val}%</div>
                    <div className="text-[8px] text-slate-600 mt-1 uppercase font-bold tracking-widest">Fidelity Avg</div>
                  </div>
                ))}
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 px-10 py-5 rounded-3xl text-center min-w-[200px] shadow-2xl shadow-indigo-600/30">
                  <div className="text-[9px] uppercase tracking-widest text-indigo-200 font-black mb-2">Omni Fidelity Index</div>
                  <div className="text-5xl font-black text-white">{aggregates.total}%</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="space-y-16 max-w-5xl mx-auto pb-40">
        {results.map((result, idx) => (
          <div key={idx} id={`slide-${result.pageNumber}`} className="glass rounded-[3rem] overflow-hidden border border-white/5 shadow-2xl animate-in fade-in slide-in-from-bottom-12 duration-1000 scroll-mt-24">
            <div className="p-12">
              <div className="flex flex-wrap items-center justify-between gap-8 mb-12 border-b border-white/5 pb-10">
                <div className="flex items-center gap-8">
                  <div className="bg-slate-900 border border-white/10 text-white font-black w-16 h-16 flex items-center justify-center rounded-[1.5rem] text-2xl shadow-inner">
                    {result.pageNumber}
                  </div>
                  <div>
                    <h4 className="text-3xl font-black tracking-tighter mb-1">Fidelity Matrix</h4>
                    <p className="text-slate-500 text-[9px] uppercase font-bold tracking-[0.4em]">3x3 Cross-Modal Authenticity Audit</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  {[
                    { val: result.clarityScore, label: "Clarity" },
                    { val: result.logicScore, label: "Logic" },
                    { val: result.narrativeFlow, label: "Flow" }
                  ].map((score, i) => (
                    <div key={i} className="bg-slate-900/60 px-4 py-3 rounded-2xl border border-white/5 text-center min-w-[80px]">
                      <div className="text-[7px] uppercase tracking-widest text-slate-500 font-black mb-1">{score.label}</div>
                      <div className="text-[14px] font-black text-slate-200">{score.val}%</div>
                    </div>
                  ))}
                  <div className="bg-indigo-600 px-8 py-3 rounded-2xl text-center min-w-[120px] shadow-xl shadow-indigo-600/20">
                    <div className="text-[8px] uppercase tracking-widest text-indigo-200 font-black mb-1">Omni Index</div>
                    <div className="text-3xl font-black text-white">{result.totalScore}%</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-10">
                  <div>
                    <h5 className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Narrative Verdict & Logic
                    </h5>
                    <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-white/5 space-y-4">
                      <p className="text-lg text-white font-bold leading-tight uppercase tracking-widest">
                        {result.narrativeVerdict}
                      </p>
                      <p className="text-[14px] text-slate-300 leading-relaxed font-medium">
                        {result.critique}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div className="bg-slate-900/40 p-6 rounded-3xl border border-white/5">
                      <h6 className="text-[8px] uppercase tracking-widest text-slate-500 font-black mb-2">Visual Density</h6>
                      <div className="text-xs font-bold text-slate-200">{result.visualDensity}</div>
                    </div>
                    <div className="bg-slate-900/40 p-6 rounded-3xl border border-white/5">
                      <h6 className="text-[8px] uppercase tracking-widest text-slate-500 font-black mb-2">Focal Point</h6>
                      <div className="text-xs font-bold text-slate-200">{result.focalPoint}</div>
                    </div>
                    <div className="bg-slate-900/40 p-6 rounded-3xl border border-white/5">
                      <h6 className="text-[8px] uppercase tracking-widest text-slate-500 font-black mb-2">Chart Quality</h6>
                      <div className="text-xs font-bold text-slate-200">{result.chartQuality}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-10">
                  <div className="bg-indigo-600/5 rounded-[2.5rem] p-10 border border-indigo-500/10 flex flex-col justify-between h-full">
                    <div>
                      <h5 className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-8 flex items-center justify-between">
                        <span>3x3 Fidelity Matrix</span>
                        <span className="text-[7px] text-slate-500 px-2 py-0.5 border border-white/10 rounded-full">Retention | Auth | Risk</span>
                      </h5>

                      <div className="space-y-6">
                        {[
                          { title: "Research -> Notes", r: result.r2n_retention, a: result.r2n_authenticity, h: result.r2n_risk },
                          { title: "Research -> Slide", r: result.r2s_retention, a: result.r2s_authenticity, h: result.r2s_risk },
                          { title: "Notes -> Slide", r: result.n2s_retention, a: result.n2s_authenticity, h: result.n2s_risk },
                        ].map((path, idx) => (
                          <div key={idx} className="bg-black/20 p-4 rounded-2xl border border-white/5">
                            <div className="text-[8px] font-black uppercase text-slate-500 mb-3 tracking-widest">{path.title}</div>
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <div className="text-[7px] text-slate-600 uppercase mb-1">Ret</div>
                                <div className="text-xs font-black">{path.r}%</div>
                              </div>
                              <div className="flex-1">
                                <div className="text-[7px] text-slate-600 uppercase mb-1">Auth</div>
                                <div className="text-xs font-black">{path.a}%</div>
                              </div>
                              <div className="flex-1">
                                <div className="text-[7px] text-slate-600 uppercase mb-1">Risk</div>
                                <div className={`text-xs font-black ${path.h > 20 ? 'text-rose-400' : 'text-slate-400'}`}>{path.h}%</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-8 p-6 bg-slate-950/40 rounded-2xl border border-white/5">
                        <h5 className="text-[8px] font-black uppercase tracking-widest text-cyan-400 mb-2">Explicit Slide Description</h5>
                        <p className="text-[10px] text-slate-400 leading-relaxed italic">
                          {result.explicitDescription}
                        </p>
                      </div>
                    </div>

                    <div className="mt-12 pt-10 border-t border-white/5">
                      <h5 className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-400 mb-4">Original Speaker Notes</h5>
                      <div className="text-[10px] text-slate-500 italic leading-relaxed bg-black/20 p-6 rounded-2xl border border-white/5">
                        {jsonFile.slides?.[result.pageNumber - 1]?.speakerNote || "No speaker notes provided in research JSON."}
                      </div>
                    </div>

                    <div className="mt-12 pt-10 border-t border-white/5">
                      <h5 className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-400 mb-4">Layout Schematic Analysis</h5>
                      <pre className="text-[9px] text-slate-500 font-mono bg-black/40 p-4 rounded-xl max-h-[120px] overflow-y-auto">
                        {result.layoutSchematic}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isProcessing && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-48 opacity-10 grayscale">
          <div className="text-9xl mb-8">🏢</div>
          <p className="font-black text-2xl tracking-[0.5em] uppercase text-center max-w-lg">
            Awaiting Multimodal Inputs
          </p>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<SlideDeckAuditor />);
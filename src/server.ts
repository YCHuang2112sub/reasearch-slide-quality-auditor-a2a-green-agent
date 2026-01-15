import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { AuditorService } from './services/auditor';
import { PDFProcessor } from './utils/pdfProcessor';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

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
    capabilities: ["assessment"],
    skills: [],
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
app.post('/assess', async (req, res) => {
    console.log("\n[REQUEST] POST /assess - New Assessment Request");
    console.log('[DEBUG] Request body keys:', Object.keys(req.body));
    const { participants, config } = req.body;

    if (!participants) {
        console.error("Participants not found in request body");
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
        const genResponse = await axios.post(`${slideGeneratorUrl}/generate`, {
            input: researchData
        });

        // ... (Processing logic remains the same) ...
        const pdfBase64 = genResponse.data.pdf;
        if (!pdfBase64) {
            throw new Error("No PDF data returned from purple agent");
        }
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const pages = await pdfProcessor.processPDF(pdfBuffer);

        const auditResults = [];
        let storyContext = "Initial Slide: No previous context.";

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const slideData = researchData.slides[i] || researchData;
            const result = await auditor.auditSlide(page.image, page.text, slideData, storyContext);
            auditResults.push(result);
            storyContext = `Slide ${i + 1} Verdict: ${result.narrativeVerdict}`;
        }

        // 4. Return Results
        // Wrap in AgentBeats A2A envelope to satisfy strict clients
        const responseData = {
            status: "completed",
            result: {
                Task: {
                    id: "task-id-placeholder",
                    contextId: "context-id-placeholder",
                    state: "completed"
                },
                Message: {
                    role: "agent",
                    messageId: "msg-id-placeholder",
                    parts: [
                        {
                            text: JSON.stringify(auditResults)
                        }
                    ]
                }
            },
            artifacts: [
                {
                    id: "audit-report",
                    type: "application/json",
                    data: auditResults
                }
            ],
            // Legacy/Direct support
            ...auditResults
        };

        // Try to construct a standard response if it looks like an A2A task
        // But for now, just return the data. The logging will help us if it fails validation again.
        res.json(responseData);

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

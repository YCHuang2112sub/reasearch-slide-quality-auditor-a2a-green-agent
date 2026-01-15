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
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const hostArg = args.indexOf('--host');

const PORT = portArg !== -1 ? parseInt(args[portArg + 1]) : (process.env.PORT ? parseInt(process.env.PORT) : 9009);
const HOST = hostArg !== -1 ? args[hostArg + 1] : '0.0.0.0';

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || '';

const auditor = new AuditorService(API_KEY);
const pdfProcessor = new PDFProcessor();

/**
 * A2A Agent Card Endpoint
 */
const getAgentCard = () => ({
    name: "Research Slide Quality Auditor",
    description: "Multimodal Green Agent for auditing research slides consistency.",
    version: "1.0.0",
    capabilities: ["assessment"],
    endpoints: {
        assess: "/assess"
    }
});

app.get('/', (req, res) => {
    res.json(getAgentCard());
});

app.get('/.well-known/agent-card.json', (req, res) => {
    res.json(getAgentCard());
});

/**
 * A2A Assessment Endpoint
 */
app.post('/assess', async (req, res) => {
    console.log("\n--- New Assessment Request ---");
    const { participants, config } = req.body;

    console.log("[DEBUG] Participants:", JSON.stringify(participants, null, 2));
    console.log("[DEBUG] Config Keys:", Object.keys(config));

    console.log("Starting Assessment...");
    console.log("Participants:", participants);

    const slideGeneratorUrl = participants.slide_generator;
    const researchData = config.research_data;

    try {
        // 1. Request Slide Generation from Purple Agent
        console.log(`[DEBUG] Requesting slide generation from purple agent at: ${slideGeneratorUrl}/generate`);
        console.log("Requesting slide generation from purple agent...");
        const genResponse = await axios.post(`${slideGeneratorUrl}/generate`, {
            input: researchData
        });

        console.log("[DEBUG] Received response from purple agent. Status:", genResponse.status);
        const pdfBase64 = genResponse.data.pdf; // Assuming purple agent returns base64 PDF
        if (!pdfBase64) {
            throw new Error("No PDF data returned from purple agent");
        }
        console.log("[DEBUG] PDF Data size:", pdfBase64.length, "chars");

        const pdfBuffer = Buffer.from(pdfBase64, 'base64');

        // 2. Process PDF to Images and Metadata
        console.log("[DEBUG] Starting PDF processing...");
        console.log("Processing PDF...");
        const pages = await pdfProcessor.processPDF(pdfBuffer);
        console.log(`[DEBUG] PDF processed. Extracted ${pages.length} pages.`);

        // 3. Perform Audit
        console.log("Performing logic audit...");
        const auditResults = [];
        let storyContext = "Initial Slide: No previous context.";

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const slideData = researchData.slides[i] || researchData; // Fallback if structure differs

            const result = await auditor.auditSlide(
                page.image,
                page.text,
                slideData,
                storyContext
            );

            auditResults.push(result);
            storyContext = `Slide ${i + 1} Verdict: ${result.narrativeVerdict}`;
        }

        // 4. Return Results as A2A Artifact
        res.json({
            status: "completed",
            artifacts: [
                {
                    id: "audit-report",
                    type: "application/json",
                    data: auditResults
                }
            ]
        });

    } catch (error: any) {
        console.error("Assessment failed:", error);
        res.status(500).json({
            status: "failed",
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Green Agent listening on port ${PORT}`);
});

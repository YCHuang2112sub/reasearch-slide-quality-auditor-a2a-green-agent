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

const PORT = process.env.PORT || 9009;
const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || '';

const auditor = new AuditorService(API_KEY);
const pdfProcessor = new PDFProcessor();

/**
 * A2A Agent Card Endpoint
 */
app.get('/', (req, res) => {
    res.json({
        name: "Research Slide Quality Auditor",
        description: "Multimodal Green Agent for auditing research slides consistency.",
        version: "1.0.0",
        capabilities: ["assessment"],
        endpoints: {
            assess: "/assess"
        }
    });
});

/**
 * A2A Assessment Endpoint
 */
app.post('/assess', async (req, res) => {
    const { participants, config } = req.body;

    console.log("Starting Assessment...");
    console.log("Participants:", participants);

    const slideGeneratorUrl = participants.slide_generator;
    const researchData = config.research_data;

    try {
        // 1. Request Slide Generation from Purple Agent
        console.log("Requesting slide generation from purple agent...");
        const genResponse = await axios.post(`${slideGeneratorUrl}/generate`, {
            input: researchData
        });

        const pdfBase64 = genResponse.data.pdf; // Assuming purple agent returns base64 PDF
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');

        // 2. Process PDF to Images and Metadata
        console.log("Processing PDF...");
        const pages = await pdfProcessor.processPDF(pdfBuffer);

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

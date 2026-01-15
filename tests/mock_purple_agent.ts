import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const PORT = 9010;

app.post('/generate', async (req, res) => {
    console.log("[DEBUG] Mock Purple Agent: Received research data for:", req.body.input?.title);

    try {
        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 400]);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        page.drawText('Hello AgentBeats! This is a valid test PDF.', {
            x: 50,
            y: 350,
            size: 20,
            font: font,
            color: rgb(0, 0, 0),
        });

        const pdfBase64 = await pdfDoc.saveAsBase64();

        console.log("[DEBUG] Mock Purple Agent: Generated valid PDF. Size:", pdfBase64.length);
        res.json({
            pdf: pdfBase64
        });
    } catch (error) {
        console.error("[DEBUG] Mock Purple Agent Error:", error);
        res.status(500).json({ error: "Failed to generate PDF" });
    }
});

app.listen(PORT, () => {
    console.log(`Mock Purple Agent listening on port ${PORT}`);
});

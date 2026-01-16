import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PDFPageData {
    image: string; // Base64
    text: string;
}

export class PDFProcessor {
    async processPDF(pdfBuffer: Buffer): Promise<PDFPageData[]> {
        console.log("[DEBUG] PDFProcessor: Starting conversion. Buffer size:", pdfBuffer.length);

        // Try pypdfium2 (via Python utility) for high fidelity
        try {
            console.log("[DEBUG] PDFProcessor: Attempting pypdfium2 conversion via Python...");
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-proc-'));
            const inputPdf = path.join(tempDir, 'input.pdf');
            const outputDir = path.join(tempDir, 'output');

            // Path to the Python utility script
            // In the container, it will be at /app/src/utils/pdf_to_png.py
            const scriptPath = path.resolve(__dirname, 'pdf_to_png.py');

            try {
                fs.writeFileSync(inputPdf, pdfBuffer);

                // Run the Python utility
                // We use python3 as per Dockerfile setup
                const cmd = `python3 "${scriptPath}" "${inputPdf}" "${outputDir}" 300`;
                console.log(`[DEBUG] Executing: ${cmd}`);
                const output = execSync(cmd).toString();

                if (!output.includes("SUCCESS")) {
                    throw new Error("Python conversion failed: " + output);
                }

                const files = fs.readdirSync(outputDir)
                    .filter(f => f.startsWith('page') && f.endsWith('.png'))
                    .sort((a, b) => {
                        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                        return numA - numB;
                    });

                console.log(`[DEBUG] PDFProcessor: pypdfium2 produced ${files.length} pages.`);

                if (files.length > 0) {
                    const results: PDFPageData[] = files.map((file) => {
                        const imgPath = path.join(outputDir, file);
                        const buffer = fs.readFileSync(imgPath);
                        return {
                            image: buffer.toString('base64'),
                            text: "Layout schematic extraction point"
                        };
                    });
                    return results;
                }
            } finally {
                // Cleanup temp files
                try {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        } catch (error: any) {
            console.warn("[DEBUG] PDFProcessor: pypdfium2 failed, falling back to pdf-img-convert:", error.message);
        }

        // Fallback to pdf-img-convert
        try {
            console.log("[DEBUG] PDFProcessor: Loading pdf-img-convert as fallback...");
            const pdfModule = await import('pdf-img-convert');
            const convert = pdfModule.convert || (pdfModule as any).default?.convert || (pdfModule as any).default;

            if (typeof convert !== 'function') {
                throw new Error("pdf-img-convert.convert is not a function");
            }

            const images = await convert(pdfBuffer, {
                page_numbers: undefined // all pages
            });

            console.log(`[DEBUG] PDFProcessor: Fallback converted ${images.length} pages.`);

            return images.map((img: any, index: number) => {
                return {
                    image: Buffer.from(img).toString('base64'),
                    text: "Layout schematic extraction point"
                };
            });
        } catch (error: any) {
            console.error("[DEBUG] PDFProcessor Final Failure:", error);
            throw error;
        }
    }
}

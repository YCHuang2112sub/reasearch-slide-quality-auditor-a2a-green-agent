import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface PDFPageData {
    image: string; // Base64
    text: string;
}

export class PDFProcessor {
    async processPDF(pdfBuffer: Buffer): Promise<PDFPageData[]> {
        console.log("[DEBUG] PDFProcessor: Starting conversion. Buffer size:", pdfBuffer.length);

        // Try Poppler (pdftoppm) first for high fidelity
        try {
            console.log("[DEBUG] PDFProcessor: Attempting Poppler (pdftoppm) conversion...");
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-proc-'));
            const inputPdf = path.join(tempDir, 'input.pdf');
            const outputPrefix = path.join(tempDir, 'page');

            try {
                fs.writeFileSync(inputPdf, pdfBuffer);

                // -r 300 for high quality, -png for PNG output
                execSync(`pdftoppm -png -r 300 "${inputPdf}" "${outputPrefix}"`);

                const files = fs.readdirSync(tempDir)
                    .filter(f => f.startsWith('page') && f.endsWith('.png'))
                    .sort((a, b) => {
                        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                        return numA - numB;
                    });

                console.log(`[DEBUG] PDFProcessor: Poppler produced ${files.length} pages.`);

                if (files.length > 0) {
                    const results: PDFPageData[] = files.map((file) => {
                        const imgPath = path.join(tempDir, file);
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
            console.warn("[DEBUG] PDFProcessor: Poppler failed or not available, falling back to pdf-img-convert:", error.message);
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
            console.error("[DEBUG] PDFProcessor Error:", error);
            throw error;
        }
    }
}

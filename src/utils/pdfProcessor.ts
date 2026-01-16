export interface PDFPageData {
    image: string; // Base64
    text: string;
}

export class PDFProcessor {
    async processPDF(pdfBuffer: Buffer): Promise<PDFPageData[]> {
        console.log("[DEBUG] PDFProcessor: Starting conversion. Buffer size:", pdfBuffer.length);

        try {
            // Dynamic import to handle potential CJS/ESM issues with pdf-img-convert
            console.log("[DEBUG] PDFProcessor: Loading pdf-img-convert...");
            const pdfModule = await import('pdf-img-convert');

            console.log("[DEBUG] PDFProcessor: Module Keys:", Object.keys(pdfModule));
            const convert = pdfModule.convert || (pdfModule as any).default?.convert || (pdfModule as any).default;

            if (typeof convert !== 'function') {
                console.error("[DEBUG] PDFProcessor: Could not find convert function. Module keys:", Object.keys(pdfModule));
                throw new Error("pdf-img-convert.convert is not a function");
            }

            console.log("[DEBUG] PDFProcessor: Calling convert function...");
            const images = await convert(pdfBuffer, {
                width: 2048,
                height: 2048, // pdf-img-convert uses these as max dimensions or strict? Docs say 'width' and 'height' set viewport.
                page_numbers: undefined // all pages
            });

            console.log(`[DEBUG] PDFProcessor: Successfully converted ${images.length} pages.`);

            return images.map((img: any, index: number) => {
                console.log(`[DEBUG] PDFProcessor: Processing page ${index + 1}/${images.length}`);
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

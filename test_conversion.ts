
import fs from 'fs';
import path from 'path';
import pdf2img from 'pdf-img-convert';

async function test() {
    console.log('--- Testing PDF Conversion ---');

    // Adjust path to point to the file in research-audit-leaderboard/debug_output
    const pdfPath = path.resolve('..', 'research-audit-leaderboard', 'debug_output', 'purple_output.pdf');

    if (!fs.existsSync(pdfPath)) {
        console.error('PDF file not found at:', pdfPath);
        return;
    }

    console.log('Loading PDF from:', pdfPath);
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log('PDF loaded, size:', pdfBuffer.length);

    try {
        console.log('Imported pdf-img-convert type:', typeof pdf2img);

        let convertFunc = pdf2img;
        // Handle common export variations
        if (typeof convertFunc !== 'function' && (pdf2img as any).convert) {
            console.log('Using .convert property');
            convertFunc = (pdf2img as any).convert;
        } else if ((pdf2img as any).default && (pdf2img as any).default.convert) {
            console.log('Using .default.convert property');
            convertFunc = (pdf2img as any).default.convert;
        }

        console.log('Final Convert function check:', typeof convertFunc);

        const images = await convertFunc(pdfBuffer, {
            width: 1024,
            height: 1024,
            page_numbers: [1] // Test just one page first
        });

        console.log('✅ Success! Converted pages:', images.length);

        if (images.length > 0) {
            fs.writeFileSync('test_output_page1.png', images[0]);
            console.log('Saved test_output_page1.png locally.');
        }

    } catch (e) {
        console.error('❌ Conversion Failed:', e);
        if (e instanceof Error) {
            console.error('Error Stack:', e.stack);
        }
    }
}

test();

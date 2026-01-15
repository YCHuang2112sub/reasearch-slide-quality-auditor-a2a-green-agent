import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

const PORT = 9010;

app.post('/generate', (req, res) => {
    console.log("Mock Purple Agent: Received research data:", req.body.input.title);

    // Return a sample base64 PDF (minimal valid PDF or just dummy string for testing)
    // For a real test, use a valid base64 PDF.
    res.json({
        pdf: "JVBERi0xLjcKOCAwIG9iaiA8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDEgMCBSIC9SZXNvdXJjZXMgMiAwIFIgL0NvbnRlbnRzIDMgMCBSID4+IGVuZG9iaiAyIDAgb2JqIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiBlbmRvYmogMyAwIG9iaiA8PCAvTGVuZ3RoIDQ0ID4+IHN0cmVhbQpCVAovRjEgMjQgVGYKNzAgNzAwIFRECltob3cgZG8geW91IHRlc3QgbG9jYWxseT9dIFRKCkVUCmVuZHN0cmVhbSBlbmRvYmo..."
    });
});

app.listen(PORT, () => {
    console.log(`Mock Purple Agent listening on port ${PORT}`);
});

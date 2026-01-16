
import pypdfium2 as pdfium
import os
import sys
from PIL import Image

def convert_pdf_to_png(pdf_path, output_dir, dpi=300):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    # Open the PDF
    pdf = pdfium.PdfDocument(pdf_path)
    n_pages = len(pdf)

    for i in range(n_pages):
        page = pdf[i]
        # PDF base is 72 DPI
        scale = dpi / 72
        bitmap = page.render(scale=scale)
        
        # Convert to PIL Image
        pil_image = bitmap.to_pil()
        
        output_filename = os.path.join(output_dir, f"page_{i+1:03d}.png")
        pil_image.save(output_filename, "PNG")

    pdf.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pdf_to_png.py <pdf_path> <output_dir> [dpi]")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 300
    
    try:
        convert_pdf_to_png(pdf_path, output_dir, dpi)
        print("SUCCESS")
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

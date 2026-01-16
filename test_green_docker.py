import requests
import json
import base64
import gzip
import os

# Read the Purple Agent's output (use debug_output files from server.ts)
json_path = r'C:\Users\User\Downloads\workspace\MOOCAgentic\deep-researcher-a2a-purple-agent\debug_output.json'
pdf_path = r'C:\Users\User\Downloads\workspace\MOOCAgentic\deep-researcher-a2a-purple-agent\debug_output.pdf'

print(f"Loading Purple Agent output...")
print(f"  JSON: {json_path}")
print(f"  PDF: {pdf_path}")

with open(json_path, 'r', encoding='utf-8') as f:
    purple_data = json.load(f)

with open(pdf_path, 'rb') as f:
    pdf_bytes = f.read()

# Compress PDF with gzip before base64 encoding
pdf_compressed = gzip.compress(pdf_bytes, compresslevel=9)
pdf_base64 = base64.b64encode(pdf_compressed).decode()

print(f"PDF original size: {len(pdf_bytes)} bytes")
print(f"PDF compressed size: {len(pdf_compressed)} bytes ({len(pdf_compressed)/len(pdf_bytes)*100:.1f}%)")
print(f"PDF base64 size: {len(pdf_base64)} characters")

# Prepare Green Agent assessment request (AgentBeats Protocol)
payload = {
    "participants": [
        {
            "agentbeats_id": "test-purple-agent",
            "name": "Purple Agent",
            "outputs": [
                {
                    "id": "slides-pdf",
                    "type": "application/pdf",
                    "data": pdf_base64,
                    "compressed": "gzip"  # Flag for backend to decompress
                },
                {
                    "id": "project-data",
                    "type": "application/json",
                    "data": purple_data
                }
            ]
        }
    ],
    "task": {
        "domain": "research-audit",
        "parameters": {}
    }
}

print("Sending assessment request to Green Agent (local backend)...")
response = requests.post('http://localhost:9009/assess', json=payload, timeout=180)

print(f"Status Code: {response.status_code}")
if response.status_code == 200:
    result = response.json()
    print("Assessment successful!")
    print(f"Overall Score: {result.get('overall_score', 'N/A')}")
    print(f"Authenticity: {result.get('authenticity', 'N/A')}")
else:
    print(f"Error: {response.text}")

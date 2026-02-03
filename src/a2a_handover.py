import sys
import json
from datetime import datetime

def format_a2a_response(payload, request_id):
    """
    Formats the audit results into a standard A2A JSON-RPC 2.0 response.
    Delivers the exact payload structure requested by the user:
    {
      "results": { "pages": [...] },
      "averages": { ... },
      "participants": { ... }
    }
    """
    timestamp = int(datetime.now().timestamp())
    task_id = request_id or f"task-{timestamp}"
    context_id = request_id or f"ctx-{timestamp}"
    msg_id = request_id or f"msg-{timestamp}"

    # Construct the single data part as requested
    # We send the entire payload (pages, averages, participants) in one part.
    artifact = {
        "id": "audit-artifact",
        "artifactId": "audit-artifact",
        "name": "Audit Report",
        "parts": [
            { "text": "Slide inspection completed successfully." },
            { "data": payload } 
        ]
    }

    # TaskStatus state is required for protocol compliance
    status = {
        "state": "completed",
        "message": {
            "role": "agent",
            "messageId": msg_id,
            "parts": [ { "text": "Assessment finalized." } ]
        }
    }

    # Final JSON-RPC 'result' structure
    result = {
        "id": task_id,
        "contextId": context_id,
        "status": status,
        "artifacts": [artifact],
        "role": "agent",
        "type": "results",
        "messageId": msg_id,
        "data": payload
    }

    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "result": result
    }

def main():
    try:
        # Read payload from stdin
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"error": "No input data provided"}), file=sys.stderr)
            sys.exit(1)
            
        data = json.loads(input_data)
        payload = data.get("payload", {})
        request_id = data.get("requestId")

        response = format_a2a_response(payload, request_id)
            
        print(json.dumps(response, indent=2))

    except Exception as e:
        import traceback
        print(f"[ERROR] Python bridge failure: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

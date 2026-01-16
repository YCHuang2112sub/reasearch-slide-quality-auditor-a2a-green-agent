# Research Slide Quality Auditor (Green Agent)

## Overview
The **Research Slide Quality Auditor** is an autonomous quality assurance agent designed to evaluate AI-generated research presentations. Acting as a "Senior Strategy Consultant" (McKinsey/Bain style), it rigorously audits the output of a target "Purple Agent" (Researcher) against a given research query.

## The Task: Deep Research Slide Generation
The Green Agent orchestrates a workflow where the Participant (Purple Agent) must:
1.  Receive a research query (e.g., "The Future of Agentic AI").
2.  Conduct autonomous research.
3.  Generate a verified PDF presentation and a structured JSON output.

## Evaluation Methodology: The 3x3 Authenticity Matrix
The core of the evaluation is the **3x3 Authenticity Matrix**, which assesses the fidelity of information transfer across three paths and three dimensions.

### The 3 Paths
1.  **[R2N] Research -> Notes**: Comparison of source research findings to the Speaker Notes.
2.  **[R2S] Research -> Slide**: Comparison of source research findings to the visible Slide content.
3.  **[N2S] Notes -> Slide**: Consistency check between Speaker Notes and visible Slide content.

### The 3 Dimensions
1.  **Retention**: Percentage of key "Atomic Claims" from the source successfully captured in the target.
2.  **Authenticity**: Accuracy of the captured information (checking for "Strategic Stretching" or exaggeration).
3.  **Hallucination Risk**: Penalty for information introduced in the target that has no basis in the source.

### Scoring
The agent calculates a **Total Score (0-100)** which is a composite of the matrix metrics plus:
-   **Narrative Flow**: Logical progression and storytelling.
-   **Visual Clarity**: Design quality and legibility.

## Metrics Definition
| Metric | Description |
| :--- | :--- |
| **Total Score** | Holistic quality score (0-100). |
| **R2N Ret** | Retention of research facts in speaker notes. |
| **R2N Auth** | Accuracy of facts in speaker notes. |
| **R2N Risk** | Hallucination penalty for speaker notes. |
| **R2S Ret** | Retention of research facts on slide. |
| **R2S Auth** | Accuracy of facts on slide. |
| **R2S Risk** | Hallucination penalty for slide. |
| **N2S Ret** | Alignment of notes with slide visuals. |
| **N2S Auth** | Accuracy of slide visuals vs notes. |
| **N2S Risk** | Discrepancy penalty between notes and slide. |

## How to Run

### Prerequisite
You must have a **Google Gemini API Key**.

### Docker
```bash
docker run -p 9009:9009 -e GEMINI_API_KEY=your_key_here ghcr.io/ychuang2112sub/reasearch-slide-quality-auditor-a2a-green-agent:main
```

### Local Development
1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Start the server:
    ```bash
    npm start
    ```
The agent listens on port `9009` by default.

## API Specification
### `POST /generate`
This endpoint is actually the *trigger* for the Green Agent to start its audit workflow (acting as an Orchestrator). It expects the Leaderboard or User to send the task config.

**Request Payload:**
```json
{
  "research_data": {
    "query": "Topic to Research"
  }
}
```

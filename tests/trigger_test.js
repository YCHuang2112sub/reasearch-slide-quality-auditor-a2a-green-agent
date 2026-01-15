import axios from 'axios';

async function testAssessment() {
    const assessmentRequest = {
        participants: {
            slide_generator: "http://localhost:9010"
        },
        config: {
            research_data: {
                slides: [
                    {
                        title: "Test Slide",
                        researchPlan: "Test Plan",
                        findings: "Test Findings",
                        speakerNote: "Test Note"
                    }
                ]
            }
        }
    };

    try {
        console.log("Sending assessment request to Green Agent...");
        const response = await axios.post('http://localhost:9009/assess', assessmentRequest);
        console.log("Assessment Result:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("Test failed:", error.response?.data || error.message);
    }
}

testAssessment();

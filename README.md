<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1G5SxhgFM3pVHUjwV8woggLcXrXDbKVwM

## Local Testing

To test the Green Agent locally:

1. **Set up Environment**:
   Duplicate `.env.local` and ensure your `GEMINI_API_KEY` is set.

2. **Start the Green Agent**:
   ```bash
   npm install
   npm run start
   ```

3. **Start the Mock Purple Agent** (in a new tab):
   ```bash
   npx tsx tests/mock_purple_agent.ts
   ```

4. **Trigger an Assessment**:
   ```bash
   node tests/trigger_test.js
   ```

## Leaderboard Configuration
Use the query in [LEADERBOARD_QUERY.json](LEADERBOARD_QUERY.json) when setting up your leaderboard on AgentBeats.

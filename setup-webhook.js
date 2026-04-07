// ─────────────────────────────────────────────────────
// ONE-TIME SETUP: Register the ClickUp webhook
// Run this once after deploying your server:
//   node setup-webhook.js
// ─────────────────────────────────────────────────────

require("dotenv").config();
const ClickUpClient = require("./clickup");

async function setup() {
  const clickup = new ClickUpClient(process.env.CLICKUP_API_TOKEN);
  const teamId = process.env.CLICKUP_TEAM_ID;
  const serverUrl = process.env.SERVER_URL;

  if (!teamId || !serverUrl || !process.env.CLICKUP_API_TOKEN) {
    console.error(
      "Missing required env vars: CLICKUP_API_TOKEN, CLICKUP_TEAM_ID, SERVER_URL"
    );
    process.exit(1);
  }

  const endpoint = `${serverUrl}/webhooks/clickup`;

  console.log(`Registering webhook for team ${teamId}...`);
  console.log(`Endpoint: ${endpoint}`);

  try {
    // Check for existing webhooks first
    const existing = await clickup.getWebhooks(teamId);
    const alreadyExists = existing.webhooks?.find(
      (w) => w.endpoint === endpoint
    );

    if (alreadyExists) {
      console.log(`Webhook already exists (ID: ${alreadyExists.id})`);
      console.log(`Secret: ${alreadyExists.secret}`);
      console.log(
        "\nAdd this to your .env as CLICKUP_WEBHOOK_SECRET if you haven't already."
      );
      return;
    }

    // Create new webhook
    const result = await clickup.createWebhook(teamId, endpoint, [
      "taskUpdated",
    ]);

    console.log("\n✅ Webhook created successfully!");
    console.log(`   ID:     ${result.id}`);
    console.log(`   Secret: ${result.webhook.secret}`);
    console.log(
      "\n⚠️  IMPORTANT: Add this secret to your .env file as CLICKUP_WEBHOOK_SECRET"
    );
    console.log(`   CLICKUP_WEBHOOK_SECRET=${result.webhook.secret}`);
  } catch (err) {
    console.error("Failed to create webhook:", err.response?.data || err.message);
  }
}

setup();

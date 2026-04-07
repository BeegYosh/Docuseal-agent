# ClickUp ↔ DocuSeal Bridge

A local Node.js bridge that sends ClickUp Docs out for signature via DocuSeal when a task's **Agreement Status** custom field is flipped to **Sent**, then tracks the signature lifecycle back into ClickUp.

## How it works

1. You draft your Representation Agreement as a **ClickUp Doc** (native). Data lives in custom fields on the related task.
2. You paste the Doc URL into the task's **Agreement Doc URL** custom field.
3. When ready, you change **Agreement Status** → **Sent**.
4. ClickUp fires a `taskUpdated` webhook at this bridge.
5. The bridge:
   - Validates required custom fields
   - Fetches the ClickUp Doc as markdown via the v3 Docs API
   - Converts it to HTML and wraps it in a styled template with `<signature-field>` / `<date-field>` tags
   - Submits it to DocuSeal via `POST /submissions/html` with signer info pre-filled
   - Posts a confirmation comment on the task
6. DocuSeal webhooks come back to `/webhooks/docuseal` for `submission.completed`, `submission.expired`, and `submission.declined` events. On completion, the signed PDF is downloaded and attached back to the ClickUp task and the status is updated.

## Required ClickUp custom fields

| Field | Type |
|---|---|
| Agreement Status | Dropdown (Draft, Ready, **Sent**, Signed, Expired, Declined) |
| Agreement Doc URL | URL |
| Client Full Name | Text |
| Client Email | Email |
| Client Phone Number | Phone |
| Client Mailing Address | Text |
| Company Name | Text |
| Effective Date | Date |
| Expiration Date | Date |
| Secondary Signer Name | Text (optional) |
| Secondary Signer Email | Email (optional) |

## Setup

```bash
npm install
cp .env.example .env
# Fill in CLICKUP_API_TOKEN, CLICKUP_TEAM_ID, DOCUSEAL_API_TOKEN
```

### Run locally

```bash
# Terminal 1 — expose port 3000 to the internet
npx ngrok http 3000
# Copy the https URL into SERVER_URL in .env

# Terminal 2 — start the server
npm start

# One-time — register the ClickUp webhook
npm run setup-webhook
# Copy the printed secret into CLICKUP_WEBHOOK_SECRET in .env, then restart npm start
```

Finally, in **DocuSeal → Settings → Webhooks**, add a webhook pointing at
`https://<your-ngrok-subdomain>.ngrok-free.app/webhooks/docuseal`.

## Files

- `server.js` — Express server, webhook handlers, send-agreement orchestration
- `clickup.js` — ClickUp v2 API client (tasks, custom fields, comments, attachments, webhooks)
- `clickup-docs.js` — ClickUp v3 Docs API client (pages, markdown fetch)
- `docuseal.js` — DocuSeal API client (templates, submissions, HTML submissions)
- `setup-webhook.js` — One-time webhook registration script

## Security notes

- `.env` is gitignored — never commit your tokens.
- The ClickUp webhook is verified with HMAC SHA256 using `CLICKUP_WEBHOOK_SECRET`.
- Run behind ngrok or any HTTPS tunnel during local development.

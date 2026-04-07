const axios = require("axios");

const DOCUSEAL_API = "https://api.docuseal.com";

class DocuSealClient {
  constructor(apiToken) {
    this.client = axios.create({
      baseURL: DOCUSEAL_API,
      headers: {
        "X-Auth-Token": apiToken,
        "Content-Type": "application/json",
      },
    });
  }

  // ─────────────────────────────────────────────
  // TEMPLATES
  // ─────────────────────────────────────────────

  async getTemplates() {
    const { data } = await this.client.get("/templates");
    return data;
  }

  async getTemplate(templateId) {
    const { data } = await this.client.get(`/templates/${templateId}`);
    return data;
  }

  // Upload a document (PDF buffer) and create a new template from it
  async createTemplateFromDocument(name, fileBuffer, filename) {
    const base64 = fileBuffer.toString("base64");
    const extension = filename.split(".").pop().toLowerCase();
    const mimeTypes = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
    };
    const contentType = mimeTypes[extension] || "application/pdf";

    const { data } = await this.client.post("/templates/pdf", {
      name,
      documents: [
        {
          name: filename,
          file: `data:${contentType};base64,${base64}`,
        },
      ],
    });
    return data;
  }

  // ─────────────────────────────────────────────
  // SUBMISSIONS (Send for signature)
  // ─────────────────────────────────────────────

  // Send a document for signature using an existing template
  // fieldMapping: { docuseal_field_name: value, ... }
  async sendForSignature(templateId, signers, fieldMapping) {
    const submitters = signers.map((signer, index) => {
      const submitter = {
        email: signer.email,
        name: signer.name || undefined,
        role: signer.role || (index === 0 ? "First Party" : "Second Party"),
        fields: [],
      };

      // Map fields to this submitter with readonly = true
      if (index === 0 && fieldMapping) {
        for (const [fieldName, value] of Object.entries(fieldMapping)) {
          if (value !== null && value !== undefined && value !== "") {
            submitter.fields.push({
              name: fieldName,
              default_value: String(value),
              readonly: true,
            });
          }
        }
      }

      return submitter;
    });

    const { data } = await this.client.post("/submissions", {
      template_id: templateId,
      send_email: true,
      submitters,
    });

    return data;
  }

  // Send using an uploaded document instead of existing template
  async sendDocumentForSignature(
    documentBuffer,
    filename,
    signers,
    fieldMapping
  ) {
    // Step 1: Create a template from the uploaded document
    const template = await this.createTemplateFromDocument(
      `Agreement - ${new Date().toISOString().split("T")[0]}`,
      documentBuffer,
      filename
    );

    // Step 2: Send for signature using the new template
    return await this.sendForSignature(template.id, signers, fieldMapping);
  }

  // ─────────────────────────────────────────────
  // SEND HTML DIRECTLY AS A ONE-OFF SUBMISSION
  // ─────────────────────────────────────────────
  //
  // This is the cleanest path for ClickUp Docs:
  //   ClickUp Doc → markdown → HTML → DocuSeal submission
  //
  // DocuSeal's /submissions/html endpoint creates and sends
  // a document in a single call. No template needed.
  //
  async sendHtmlForSignature(html, name, signers, fieldMapping) {
    // Build submitters with pre-filled fields on the first party
    const submitters = signers.map((signer, index) => {
      const submitter = {
        email: signer.email,
        name: signer.name || undefined,
        role: signer.role || (index === 0 ? "First Party" : "Second Party"),
        fields: [],
      };

      if (index === 0 && fieldMapping) {
        for (const [fieldName, value] of Object.entries(fieldMapping)) {
          if (value !== null && value !== undefined && value !== "") {
            submitter.fields.push({
              name: fieldName,
              default_value: String(value),
              readonly: true,
            });
          }
        }
      }

      return submitter;
    });

    const { data } = await this.client.post("/submissions/html", {
      name,
      html,
      send_email: true,
      submitters,
    });

    return data;
  }

  // ─────────────────────────────────────────────
  // SUBMISSIONS STATUS
  // ─────────────────────────────────────────────

  async getSubmission(submissionId) {
    const { data } = await this.client.get(`/submissions/${submissionId}`);
    return data;
  }

  async getSubmissions(params = {}) {
    const { data } = await this.client.get("/submissions", { params });
    return data;
  }

  // Download the signed document
  async downloadSignedDocument(submitter) {
    if (!submitter.documents || submitter.documents.length === 0) {
      throw new Error("No signed documents available");
    }

    const docUrl = submitter.documents[0].url;
    const { data } = await axios.get(docUrl, { responseType: "arraybuffer" });
    return Buffer.from(data);
  }
}

module.exports = DocuSealClient;

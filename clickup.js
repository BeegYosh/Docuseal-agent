const axios = require("axios");

const CLICKUP_API = "https://api.clickup.com/api/v2";

class ClickUpClient {
  constructor(apiToken) {
    this.client = axios.create({
      baseURL: CLICKUP_API,
      headers: {
        Authorization: apiToken,
        "Content-Type": "application/json",
      },
    });
  }

  // ─────────────────────────────────────────────
  // TASKS
  // ─────────────────────────────────────────────

  async getTask(taskId) {
    const { data } = await this.client.get(`/task/${taskId}`, {
      params: { include_subtasks: false },
    });
    return data;
  }

  // Extract custom field values into a clean object
  // Returns: { "Field Name": value, ... }
  extractCustomFields(task) {
    const fields = {};
    if (!task.custom_fields) return fields;

    for (const field of task.custom_fields) {
      const name = field.name;
      const type = field.type;
      let value = field.value;

      // Normalize based on field type
      if (type === "drop_down" && field.type_config?.options) {
        const selected = field.type_config.options.find(
          (opt) => opt.orderindex === value
        );
        value = selected ? selected.name : null;
      } else if (type === "labels" && Array.isArray(value)) {
        const options = field.type_config?.options || [];
        value = value.map((v) => {
          const opt = options.find((o) => o.id === v);
          return opt ? opt.label : v;
        });
      } else if (type === "date" && value) {
        value = new Date(parseInt(value)).toISOString().split("T")[0];
      } else if (type === "checkbox") {
        value = value === true || value === "true";
      }

      fields[name] = value;
    }

    return fields;
  }

  // ─────────────────────────────────────────────
  // CUSTOM FIELDS
  // ─────────────────────────────────────────────

  async setCustomFieldValue(taskId, fieldId, value) {
    await this.client.post(`/task/${taskId}/field/${fieldId}`, { value });
  }

  // Find a custom field ID by name on a task
  findFieldId(task, fieldName) {
    if (!task.custom_fields) return null;
    const field = task.custom_fields.find(
      (f) => f.name.toLowerCase() === fieldName.toLowerCase()
    );
    return field ? field.id : null;
  }

  // Find a dropdown option orderindex by label
  findDropdownIndex(task, fieldName, optionLabel) {
    if (!task.custom_fields) return null;
    const field = task.custom_fields.find(
      (f) => f.name.toLowerCase() === fieldName.toLowerCase()
    );
    if (!field || field.type !== "drop_down") return null;
    const option = field.type_config?.options?.find(
      (o) => o.name.toLowerCase() === optionLabel.toLowerCase()
    );
    return option ? option.orderindex : null;
  }

  // ─────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────

  async updateTaskStatus(taskId, status) {
    await this.client.put(`/task/${taskId}`, { status });
  }

  // ─────────────────────────────────────────────
  // COMMENTS
  // ─────────────────────────────────────────────

  async postComment(taskId, text) {
    await this.client.post(`/task/${taskId}/comment`, {
      comment_text: text,
    });
  }

  // ─────────────────────────────────────────────
  // ATTACHMENTS
  // ─────────────────────────────────────────────

  async getTaskAttachments(task) {
    // Attachments come from the task's attachments array
    return task.attachments || [];
  }

  async downloadAttachment(url) {
    const { data } = await axios.get(url, {
      responseType: "arraybuffer",
      headers: { Authorization: this.client.defaults.headers.Authorization },
    });
    return Buffer.from(data);
  }

  async uploadAttachment(taskId, fileBuffer, filename) {
    const FormData = require("form-data") || (await import("form-data"));
    const form = new (FormData.default || FormData)();
    form.append("attachment", fileBuffer, { filename });

    await this.client.post(`/task/${taskId}/attachment`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: this.client.defaults.headers.Authorization,
      },
    });
  }

  // ─────────────────────────────────────────────
  // WEBHOOKS
  // ─────────────────────────────────────────────

  async createWebhook(teamId, endpoint, events) {
    const { data } = await this.client.post(`/team/${teamId}/webhook`, {
      endpoint,
      events,
    });
    return data;
  }

  async getWebhooks(teamId) {
    const { data } = await this.client.get(`/team/${teamId}/webhook`);
    return data;
  }

  async deleteWebhook(webhookId) {
    await this.client.delete(`/webhook/${webhookId}`);
  }
}

module.exports = ClickUpClient;

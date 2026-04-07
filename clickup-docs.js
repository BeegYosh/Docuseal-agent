// ─────────────────────────────────────────────────────
// ClickUp Docs API v3 Client
// ─────────────────────────────────────────────────────
// The Docs API lives on v3 and uses a different structure
// than the v2 task API. Docs are organized as a tree of pages.

const axios = require("axios");

const CLICKUP_API_V3 = "https://api.clickup.com/api/v3";

class ClickUpDocsClient {
  constructor(apiToken, workspaceId) {
    this.workspaceId = workspaceId;
    this.client = axios.create({
      baseURL: CLICKUP_API_V3,
      headers: {
        Authorization: apiToken,
        "Content-Type": "application/json",
      },
    });
  }

  // ─────────────────────────────────────────────
  // URL PARSING
  // ─────────────────────────────────────────────
  //
  // Extract the doc_id from a ClickUp Doc URL.
  // Supported URL formats:
  //   https://app.clickup.com/{team_id}/v/dc/{doc_id}
  //   https://app.clickup.com/{team_id}/v/dc/{doc_id}/{page_id}
  //   https://app.clickup.com/{team_id}/docs/{doc_id}
  //   Just a bare doc_id string
  //
  static parseDocUrl(urlOrId) {
    if (!urlOrId) return { docId: null, pageId: null };

    // Handle raw ID
    if (!urlOrId.includes("/") && !urlOrId.includes("http")) {
      return { docId: urlOrId, pageId: null };
    }

    // Match /dc/{doc_id} optionally followed by /{page_id}
    const dcMatch = urlOrId.match(/\/dc\/([a-zA-Z0-9-]+)(?:\/([a-zA-Z0-9-]+))?/);
    if (dcMatch) {
      return { docId: dcMatch[1], pageId: dcMatch[2] || null };
    }

    // Match /docs/{doc_id}
    const docsMatch = urlOrId.match(/\/docs\/([a-zA-Z0-9-]+)/);
    if (docsMatch) {
      return { docId: docsMatch[1], pageId: null };
    }

    return { docId: null, pageId: null };
  }

  // ─────────────────────────────────────────────
  // LIST PAGES IN A DOC
  // ─────────────────────────────────────────────

  _assertWorkspace() {
    if (!this.workspaceId) {
      throw new Error(
        "CLICKUP_TEAM_ID is not set — cannot call the ClickUp Docs API. Add it to your .env file."
      );
    }
  }

  async listPages(docId) {
    this._assertWorkspace();
    const { data } = await this.client.get(
      `/workspaces/${this.workspaceId}/docs/${docId}/pageListing`,
      { params: { max_page_depth: -1 } }
    );
    return data;
  }

  // Recursively flatten a page tree into an ordered array
  flattenPages(pageList) {
    const pages = [];
    const walk = (nodes) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        pages.push({ id: node.id, name: node.name });
        if (node.pages && node.pages.length > 0) {
          walk(node.pages);
        }
      }
    };
    walk(pageList);
    return pages;
  }

  // ─────────────────────────────────────────────
  // GET PAGE CONTENT (as markdown)
  // ─────────────────────────────────────────────

  async getPage(docId, pageId) {
    this._assertWorkspace();
    const { data } = await this.client.get(
      `/workspaces/${this.workspaceId}/docs/${docId}/pages/${pageId}`,
      { params: { content_format: "text/md" } }
    );
    return data;
  }

  // ─────────────────────────────────────────────
  // FETCH FULL DOC AS MARKDOWN
  // ─────────────────────────────────────────────
  //
  // Walks all pages in the doc and concatenates them in order.
  // Returns a single markdown string representing the whole doc.
  //
  async fetchFullDocAsMarkdown(docId, specificPageId = null) {
    // If caller specified a single page, just return that one
    if (specificPageId) {
      const page = await this.getPage(docId, specificPageId);
      return {
        title: page.name || "Agreement",
        markdown: page.content || "",
      };
    }

    // Otherwise walk the whole doc
    const pageList = await this.listPages(docId);
    const flatPages = this.flattenPages(pageList);

    if (flatPages.length === 0) {
      throw new Error(`Doc ${docId} has no pages`);
    }

    // Fetch content for each page in order
    const sections = [];
    let docTitle = null;

    for (const page of flatPages) {
      try {
        const pageData = await this.getPage(docId, page.id);
        if (!docTitle) docTitle = pageData.name || page.name;
        const content = pageData.content || "";
        sections.push(content);
      } catch (err) {
        console.error(
          `[DOCS] Failed to fetch page ${page.id}:`,
          err.message
        );
      }
    }

    return {
      title: docTitle || "Agreement",
      markdown: sections.join("\n\n"),
    };
  }
}

module.exports = ClickUpDocsClient;

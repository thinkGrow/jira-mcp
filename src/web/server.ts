import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createProvider } from "../config.js";
import { TicketNotFoundError } from "../providers/provider.js";

/** Walk up from this file until we find the directory holding package.json. */
function findProjectRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("Could not locate project root (package.json not found).");
}

const root = findProjectRoot();
const provider = createProvider();
const app = express();
app.use(express.json());

const PROVIDER_NAME = (process.env.TICKET_PROVIDER ?? "mock").toLowerCase();

/** Turn a thrown error into the right HTTP status + JSON body. */
function sendError(res: express.Response, err: unknown): void {
  if (err instanceof TicketNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  // Validation-style messages (bad status) → 400, everything else → 500.
  const status = /invalid status/i.test(message) ? 400 : 500;
  res.status(status).json({ error: message });
}

// Which data source is live (shown in the UI banner).
app.get("/api/meta", (_req, res) => {
  res.json({ provider: PROVIDER_NAME });
});

// List all tickets (attachments listed as metadata only, no bytes).
app.get("/api/tickets", async (_req, res) => {
  try {
    res.json(await provider.listTickets());
  } catch (err) {
    sendError(res, err);
  }
});

// One ticket.
app.get("/api/tickets/:code", async (req, res) => {
  try {
    res.json(await provider.getTicket(req.params.code));
  } catch (err) {
    sendError(res, err);
  }
});

// Attachment bytes, served with the right content type so <img> can load it.
app.get("/api/tickets/:code/attachments/:id", async (req, res) => {
  try {
    const ticket = await provider.getTicket(req.params.code);
    const data = await provider.loadAttachment(ticket, req.params.id);
    res.setHeader("Content-Type", data.mimeType);
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(data.base64, "base64"));
  } catch (err) {
    sendError(res, err);
  }
});

// Add a comment.
app.post("/api/tickets/:code/comments", async (req, res) => {
  try {
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!body) {
      res.status(400).json({ error: "Comment body is required." });
      return;
    }
    res.status(201).json(await provider.addComment(req.params.code, body));
  } catch (err) {
    sendError(res, err);
  }
});

// Update status.
app.patch("/api/tickets/:code", async (req, res) => {
  try {
    const status = req.body?.status;
    if (typeof status !== "string") {
      res.status(400).json({ error: "A status string is required." });
      return;
    }
    res.json(await provider.updateStatus(req.params.code, status));
  } catch (err) {
    sendError(res, err);
  }
});

// Static frontend.
app.use(express.static(path.join(root, "public")));

const port = Number(process.env.PORT ?? 5050);
app.listen(port, () => {
  console.log(`jira-mcp web UI on http://localhost:${port}  (provider: ${PROVIDER_NAME})`);
});

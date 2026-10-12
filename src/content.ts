import type { AttachmentData } from "./providers/provider.js";
import type { Comment, Ticket } from "./types.js";

/** MCP content block shapes used by the tools. */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

function formatComment(c: Comment): string {
  return `  - [${c.createdAt}] ${c.author}:\n    ${c.body.replace(/\n/g, "\n    ")}`;
}

/** Render a ticket as a readable text block for Claude. */
export function formatTicketText(ticket: Ticket): string {
  const lines: string[] = [
    `# ${ticket.code} — ${ticket.title}`,
    `Status: ${ticket.status}`,
    "",
    "## Description",
    ticket.description,
  ];

  if (ticket.attachments.length > 0) {
    lines.push("", "## Attachments");
    for (const a of ticket.attachments) {
      lines.push(`  - ${a.filename} (${a.mimeType}) [id: ${a.id}]`);
    }
    lines.push("", "_(Image attachments are included below as image blocks.)_");
  }

  lines.push("", "## Comments");
  if (ticket.comments.length === 0) {
    lines.push("  (none)");
  } else {
    lines.push(...ticket.comments.map(formatComment));
  }

  return lines.join("\n");
}

/** Build an image content block from loaded attachment bytes. */
export function imageBlock(data: AttachmentData): ContentBlock {
  return { type: "image", data: data.base64, mimeType: data.mimeType };
}

export function textBlock(text: string): ContentBlock {
  return { type: "text", text };
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createProvider } from "./config.js";
import {
  type ContentBlock,
  formatTicketText,
  imageBlock,
  textBlock,
} from "./content.js";
import { TicketNotFoundError } from "./providers/provider.js";
import { STATUSES } from "./types.js";

/** Only image attachments are returned as image blocks; others are listed in text. */
function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function errorResult(message: string) {
  return { isError: true, content: [textBlock(message)] };
}

export function createServer(): McpServer {
  const provider = createProvider();

  const server = new McpServer({
    name: "jira-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "get_ticket",
    {
      title: "Get ticket",
      description:
        "Fetch a ticket by its code and return its title, status, description, " +
        "comments, and any image attachments (as viewable image blocks).",
      inputSchema: {
        code: z.string().min(1).describe("The ticket code, e.g. PEN-101"),
      },
    },
    async ({ code }) => {
      try {
        const ticket = await provider.getTicket(code);
        const content: ContentBlock[] = [textBlock(formatTicketText(ticket))];

        for (const attachment of ticket.attachments) {
          if (!isImage(attachment.mimeType)) continue;
          try {
            const data = await provider.loadAttachment(ticket, attachment.id);
            content.push(textBlock(`Attachment: ${attachment.filename}`));
            content.push(imageBlock(data));
          } catch (err) {
            content.push(
              textBlock(`(Could not load attachment ${attachment.filename}: ${errMsg(err)})`),
            );
          }
        }

        return { content };
      } catch (err) {
        return errorResult(errMsg(err));
      }
    },
  );

  server.registerTool(
    "add_comment",
    {
      title: "Add comment",
      description: "Post a comment to a ticket.",
      inputSchema: {
        code: z.string().min(1).describe("The ticket code, e.g. PEN-101"),
        body: z.string().min(1).describe("The comment text (markdown allowed)"),
      },
    },
    async ({ code, body }) => {
      try {
        const comment = await provider.addComment(code, body);
        return {
          content: [
            textBlock(
              `Comment added to ${code} (id: ${comment.id}, at ${comment.createdAt}).`,
            ),
          ],
        };
      } catch (err) {
        return errorResult(errMsg(err));
      }
    },
  );

  server.registerTool(
    "update_ticket_status",
    {
      title: "Update ticket status",
      description: `Change a ticket's status. Valid statuses: ${STATUSES.join(", ")}.`,
      inputSchema: {
        code: z.string().min(1).describe("The ticket code, e.g. PEN-101"),
        status: z.enum(STATUSES).describe("The new status"),
      },
    },
    async ({ code, status }) => {
      try {
        const ticket = await provider.updateStatus(code, status);
        return {
          content: [textBlock(`${ticket.code} is now "${ticket.status}".`)],
        };
      } catch (err) {
        return errorResult(errMsg(err));
      }
    },
  );

  return server;
}

function errMsg(err: unknown): string {
  if (err instanceof TicketNotFoundError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

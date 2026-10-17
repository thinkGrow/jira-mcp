import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type AttachmentData,
  type DataProvider,
  TicketNotFoundError,
} from "./provider.js";
import { STATUSES, type Comment, type Status, type Ticket } from "../types.js";

/**
 * Reads and writes tickets from a local JSON file so the demo shows real
 * round-trips (a comment added via the tool persists and shows up on re-fetch).
 */
export class MockProvider implements DataProvider {
  constructor(private readonly mockDir: string) {}

  private get ticketsFile(): string {
    return path.join(this.mockDir, "tickets.json");
  }

  private async readAll(): Promise<Ticket[]> {
    const raw = await readFile(this.ticketsFile, "utf8");
    return JSON.parse(raw) as Ticket[];
  }

  private async writeAll(tickets: Ticket[]): Promise<void> {
    await writeFile(this.ticketsFile, JSON.stringify(tickets, null, 2) + "\n", "utf8");
  }

  private find(tickets: Ticket[], code: string): Ticket {
    const ticket = tickets.find((t) => t.code.toLowerCase() === code.toLowerCase());
    if (!ticket) throw new TicketNotFoundError(code);
    return ticket;
  }

  async listTickets(): Promise<Ticket[]> {
    return this.readAll();
  }

  async getTicket(code: string): Promise<Ticket> {
    return this.find(await this.readAll(), code);
  }

  async addComment(code: string, body: string): Promise<Comment> {
    const tickets = await this.readAll();
    const ticket = this.find(tickets, code);
    const comment: Comment = {
      id: randomUUID(),
      author: "me (via jira-mcp)",
      body,
      createdAt: new Date().toISOString(),
    };
    ticket.comments.push(comment);
    await this.writeAll(tickets);
    return comment;
  }

  async updateStatus(code: string, status: string): Promise<Ticket> {
    if (!(STATUSES as readonly string[]).includes(status)) {
      throw new Error(
        `Invalid status "${status}". Valid statuses: ${STATUSES.join(", ")}.`,
      );
    }
    const tickets = await this.readAll();
    const ticket = this.find(tickets, code);
    ticket.status = status as Status;
    await this.writeAll(tickets);
    return ticket;
  }

  async loadAttachment(ticket: Ticket, attachmentId: string): Promise<AttachmentData> {
    const attachment = ticket.attachments.find((a) => a.id === attachmentId);
    if (!attachment) {
      throw new Error(`Attachment "${attachmentId}" not found on ${ticket.code}.`);
    }
    // In the mock, `path` is relative to mock/images (or the mock dir).
    const abs = path.isAbsolute(attachment.path)
      ? attachment.path
      : path.join(this.mockDir, attachment.path);
    const bytes = await readFile(abs);
    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      base64: bytes.toString("base64"),
    };
  }
}

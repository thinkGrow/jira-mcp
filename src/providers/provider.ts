import type { Comment, Ticket } from "../types.js";

/** Raw bytes of an attachment, ready to be returned as an MCP image block. */
export interface AttachmentData {
  filename: string;
  mimeType: string;
  /** base64-encoded file contents. */
  base64: string;
}

/**
 * The single seam between the MCP tools and where ticket data lives.
 *
 * `MockProvider` implements this against local JSON for the demo;
 * `HttpProvider` implements it against the real API after approval.
 * The tools in server.ts only ever talk to this interface.
 */
export interface DataProvider {
  /** All tickets, for the list/board view. */
  listTickets(): Promise<Ticket[]>;
  getTicket(code: string): Promise<Ticket>;
  addComment(code: string, body: string): Promise<Comment>;
  updateStatus(code: string, status: string): Promise<Ticket>;
  /** Load an attachment's bytes (local file read in mock, download in http). */
  loadAttachment(ticket: Ticket, attachmentId: string): Promise<AttachmentData>;
}

/** Thrown when a ticket code isn't found; tools turn this into a clean error result. */
export class TicketNotFoundError extends Error {
  constructor(code: string) {
    super(`No ticket found with code "${code}".`);
    this.name = "TicketNotFoundError";
  }
}

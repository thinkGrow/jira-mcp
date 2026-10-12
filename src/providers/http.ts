import {
  type AttachmentData,
  type DataProvider,
  TicketNotFoundError,
} from "./provider.js";
import type { Comment, Ticket } from "../types.js";

export interface HttpProviderOptions {
  baseUrl: string;
  token: string;
}

/**
 * Talks to the real in-house ticketing API.
 *
 * This is wired into the provider switch now so the demo can show exactly what
 * the cutover involves, but the request/response mapping is left as a stub until
 * the real API's payload shape is confirmed after approval. Flip
 * TICKET_PROVIDER=http and fill in the TODOs below — the tools never change.
 */
export class HttpProvider implements DataProvider {
  constructor(private readonly opts: HttpProviderOptions) {}

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.opts.token}`,
      "Content-Type": "application/json",
    };
  }

  private url(pathname: string): string {
    return new URL(pathname.replace(/^\//, ""), this.opts.baseUrl.replace(/\/?$/, "/")).toString();
  }

  async getTicket(code: string): Promise<Ticket> {
    const res = await fetch(this.url(`tickets/${encodeURIComponent(code)}`), {
      headers: this.headers(),
    });
    if (res.status === 404) throw new TicketNotFoundError(code);
    if (!res.ok) throw new Error(`GET ticket ${code} failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    // TODO: map the real payload into our Ticket shape (types.ts).
    return data as Ticket;
  }

  async addComment(code: string, body: string): Promise<Comment> {
    const res = await fetch(this.url(`tickets/${encodeURIComponent(code)}/comments`), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ body }),
    });
    if (res.status === 404) throw new TicketNotFoundError(code);
    if (!res.ok) throw new Error(`POST comment on ${code} failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    // TODO: map the real comment payload into our Comment shape.
    return data as Comment;
  }

  async updateStatus(code: string, status: string): Promise<Ticket> {
    const res = await fetch(this.url(`tickets/${encodeURIComponent(code)}`), {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ status }),
    });
    if (res.status === 404) throw new TicketNotFoundError(code);
    if (!res.ok) throw new Error(`PATCH status on ${code} failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return data as Ticket;
  }

  async loadAttachment(ticket: Ticket, attachmentId: string): Promise<AttachmentData> {
    const attachment = ticket.attachments.find((a) => a.id === attachmentId);
    if (!attachment) {
      throw new Error(`Attachment "${attachmentId}" not found on ${ticket.code}.`);
    }
    // In the real API, `path` is a URL (possibly needing auth).
    const res = await fetch(attachment.path, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(`Download attachment ${attachment.filename} failed: ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      base64: buf.toString("base64"),
    };
  }
}

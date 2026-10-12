/** The set of ticket statuses the system recognises. Edit to match the real system. */
export const STATUSES = [
  "Open",
  "In Progress",
  "In Review",
  "Done",
  "Blocked",
] as const;

export type Status = (typeof STATUSES)[number];

/** An image (or other file) attached to a ticket or referenced from its description. */
export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  /** Local file path (mock) or remote URL (real API). Resolved by the provider. */
  path: string;
}

export interface Comment {
  id: string;
  author: string;
  body: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

export interface Ticket {
  code: string;
  title: string;
  status: Status;
  /** Markdown; may reference attachments by filename. */
  description: string;
  attachments: Attachment[];
  comments: Comment[];
}

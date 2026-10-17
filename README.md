# jira-mcp

A local **MCP server** for the company's in-house (Jira-like) ticketing system.
Add it to Claude Code and pull a ticket — code, title, description with **inline
images**, and comments — straight into context, then **post comments** and
**change status** back, with no copy-paste.

It runs entirely off **fake JSON** on your machine for the demo. Once the company
approves real API access, you point it at the real API by flipping one env var —
the tool surface never changes.

## Why

Before granting real API access, the team wants a local demo built on mock data.
This server is structured so that the demo and the production version share the
exact same tools; only the data source swaps.

## Decisions

- **Language:** TypeScript (official `@modelcontextprotocol/sdk`, stdio transport).
- **Tools:** `get_ticket`, `add_comment`, `update_ticket_status`. (List/search is out of scope for the demo.)
- **Images:** returned as **real image content blocks** so Claude Code can see the pixels.
- **Real-API swap:** a single `DataProvider` interface — `MockProvider` (JSON) now, `HttpProvider` (real API) later, selected by env var. Tools never change.

## Architecture

```
jira-mcp/
  package.json            # type: module, bin, build/dev scripts
  tsconfig.json           # NodeNext, strict, outDir dist/
  .gitignore              # node_modules, dist, .env
  .env.example            # TICKET_PROVIDER, TICKET_API_BASE_URL, TICKET_API_TOKEN
  .mcp.json.example       # ready-to-copy Claude Code registration
  src/
    index.ts              # entrypoint: build server, connect StdioServerTransport
    config.ts             # read env, pick provider (mock default)
    types.ts              # Ticket, Comment, Attachment, Status
    server.ts             # create McpServer, register the 3 tools
    content.ts            # helper: ticket -> MCP content[] (text + image blocks)
    providers/
      provider.ts         # DataProvider interface
      mock.ts             # reads/writes mock/tickets.json, loads image files
      http.ts             # real-API provider (stub wired, filled post-approval)
  mock/
    tickets.json          # 2-3 fake tickets with descriptions + comments
    images/               # sample PNGs referenced by descriptions/attachments
```

### DataProvider interface (`src/providers/provider.ts`)

```ts
export interface DataProvider {
  getTicket(code: string): Promise<Ticket>;
  addComment(code: string, body: string): Promise<Comment>;
  updateStatus(code: string, status: string): Promise<Ticket>;
}
```

`config.ts` returns `new MockProvider(...)` when `TICKET_PROVIDER=mock` (default)
or `new HttpProvider(...)` when `=http`. This is the only line that changes at
approval time.

### Types (`src/types.ts`)

- `Attachment { id, filename, mimeType, path }` — `path` is a local file under `mock/images/` in the demo; a URL in the real provider.
- `Ticket { code, title, status, description, attachments: Attachment[], comments: Comment[] }` — `description` is markdown that may reference attachments by id/filename.
- `Comment { id, author, body, createdAt }`.
- `Status` — a small configurable set (Open, In Progress, In Review, Done, Blocked); validated in the tool, easy to edit.

### Tools (`src/server.ts`, via `server.registerTool`)

1. **`get_ticket`** — input `{ code }`. Fetches the ticket and returns a `content[]`:
   a text block (code, title, status, description, formatted comments) followed by
   one `{ type: "image", data: <base64>, mimeType }` block per attachment (built in `content.ts`).
2. **`add_comment`** — input `{ code, body }`. Appends a comment (mock: rewrites `tickets.json`), returns a confirmation text block.
3. **`update_ticket_status`** — input `{ code, status }`. Validates status, updates the ticket, returns the new state.

Each tool uses a Zod input schema; errors are returned as `isError` content, not thrown.

### MockProvider (`src/providers/mock.ts`)

- Loads `mock/tickets.json` on demand; writes back for `addComment` / `updateStatus` so the demo shows real round-trips.
- Resolves each attachment `path` under `mock/images/`, reads the file, base64-encodes it for the image content block.

### HttpProvider (`src/providers/http.ts`)

- Wired into the provider switch now but left as a thin stub:
  `fetch(`${baseUrl}/tickets/${code}`, { headers: { Authorization } })`, mapping the
  real payload into our `Ticket` type and downloading attachment URLs to base64.
  Filled in once the real API shape is known post-approval. Keeps the demo honest
  about what the swap involves.

## Setup

```bash
npm install
npm run build
```

### Register in Claude Code (`.mcp.json`)

Copy `.mcp.json.example` to `.mcp.json` and set the absolute path:

```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/jira-mcp/dist/index.js"],
      "env": { "TICKET_PROVIDER": "mock" }
    }
  }
}
```

Or add it with the CLI:

```bash
claude mcp add jira-mcp -- node /absolute/path/to/jira-mcp/dist/index.js
```

## Verification (end-to-end)

1. `npm install && npm run build`.
2. **Inspector smoke test:** `npx @modelcontextprotocol/inspector node dist/index.js` — confirm the 3 tools list; call `get_ticket` with a mock code and verify the image block renders; call `add_comment` and re-fetch to confirm it persisted; call `update_ticket_status` and confirm the state change.
3. **In Claude Code:** copy `.mcp.json.example` → project `.mcp.json`, restart, and run the same three tools from a real session — confirm Claude actually *sees* the ticket image.
4. **Demo for the company:** fetch a ticket (image appears in Claude) → add a comment → change status, all against fake JSON; then show that `TICKET_PROVIDER=http` is the only switch needed for the real API.

## Live web UI

A browser UI backed by the **same `DataProvider`** as the MCP, so changes made
in the page and changes made through Claude Code both hit `mock/tickets.json`
(and later the real API) and show up on both sides. The page polls every few
seconds, so an MCP-driven change appears on its own.

```bash
npm run build && npm run web     # serves http://localhost:5050
# or, no build step:
npm run dev:web
```

Open http://localhost:5050, then in Claude Code say e.g. "move PEN-102 to In
Progress" and watch the browser update. It's an Express server (`src/web/server.ts`)
exposing a small REST API over the provider, with the frontend in `public/`.
Set `PORT` to change the port.

(There's also a standalone static mockup at `demo/pentrack.html` — no server,
data baked in — for quick show-and-tell only.)

## Going live (after approval)

Set `TICKET_PROVIDER=http` and provide `TICKET_API_BASE_URL` / `TICKET_API_TOKEN`,
then fill in `src/providers/http.ts` to match the real API's payload shape.
Both the MCP server and the web UI pick it up — no code change.

## Out of scope (for the demo)

List/search tools, auth flows for the real API, pagination, and uploading
attachments back to tickets. Revisit after approval.

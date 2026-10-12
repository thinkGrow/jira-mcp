// End-to-end smoke test: launches the built server over stdio and exercises
// all three tools the way an MCP client (Claude Code) would.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(root, "dist", "index.js")],
  env: { ...process.env, TICKET_PROVIDER: "mock" },
});

const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);

const summarize = (res) =>
  res.content.map((b) =>
    b.type === "image" ? `<image ${b.mimeType} ${b.data.length}b base64>` : b.text,
  );

const tools = await client.listTools();
console.log("Tools:", tools.tools.map((t) => t.name).join(", "));

console.log("\n== get_ticket PEN-101 ==");
console.log(summarize(await client.callTool({ name: "get_ticket", arguments: { code: "PEN-101" } })).join("\n"));

console.log("\n== add_comment PEN-101 ==");
console.log(summarize(await client.callTool({
  name: "add_comment",
  arguments: { code: "PEN-101", body: "Fix pushed to branch, PR incoming." },
})).join("\n"));

console.log("\n== update_ticket_status PEN-101 -> In Review ==");
console.log(summarize(await client.callTool({
  name: "update_ticket_status",
  arguments: { code: "PEN-101", status: "In Review" },
})).join("\n"));

console.log("\n== re-fetch PEN-101 (comment + status persisted?) ==");
const refetch = summarize(await client.callTool({ name: "get_ticket", arguments: { code: "PEN-101" } }));
console.log(refetch.filter((l) => typeof l === "string" && !l.startsWith("<image")).join("\n"));

console.log("\n== error path: unknown ticket ==");
const missing = await client.callTool({ name: "get_ticket", arguments: { code: "NOPE-1" } });
console.log("isError:", missing.isError, "|", summarize(missing).join(" "));

await client.close();
console.log("\nSmoke test OK");

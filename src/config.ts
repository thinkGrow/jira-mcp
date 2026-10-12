import { fileURLToPath } from "node:url";
import path from "node:path";
import type { DataProvider } from "./providers/provider.js";
import { MockProvider } from "./providers/mock.js";
import { HttpProvider } from "./providers/http.js";

/** Project root (one level up from src/ or dist/, which both sit under the root). */
function projectRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..");
}

/** Pick the data provider from the environment. Defaults to the mock. */
export function createProvider(): DataProvider {
  const provider = (process.env.TICKET_PROVIDER ?? "mock").toLowerCase();

  if (provider === "http") {
    const baseUrl = process.env.TICKET_API_BASE_URL;
    const token = process.env.TICKET_API_TOKEN;
    if (!baseUrl || !token) {
      throw new Error(
        "TICKET_PROVIDER=http requires TICKET_API_BASE_URL and TICKET_API_TOKEN.",
      );
    }
    return new HttpProvider({ baseUrl, token });
  }

  if (provider !== "mock") {
    throw new Error(`Unknown TICKET_PROVIDER "${provider}". Use "mock" or "http".`);
  }

  return new MockProvider(path.join(projectRoot(), "mock"));
}

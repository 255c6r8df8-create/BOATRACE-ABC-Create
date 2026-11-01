import { env } from "cloudflare:workers";

export function isResultsOwner(request: Request): boolean {
  const owner = env.RESULTS_OWNER_EMAIL?.trim().toLowerCase();
  const caller = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  return !!owner && !!caller && owner === caller;
}

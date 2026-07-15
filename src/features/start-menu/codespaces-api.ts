import { ghRequest } from "@/lib/github";

export type Codespace = {
  name: string;
  state: string;
  webUrl: string;
  createdAt: string;
};

export type CodespacesResult =
  | { status: "ok"; items: Codespace[] }
  | { status: "forbidden"; message: string }
  | { status: "error"; message: string };

/** GitHub has no "codespaces for this repo" endpoint — lists the user's
 * codespaces and filters client-side by repository full name. */
export async function fetchCodespaces(fullName: string): Promise<CodespacesResult> {
  const res = await ghRequest(`/user/codespaces?per_page=100`);
  if (res.status === 403 || res.status === 401) {
    return { status: "forbidden", message: 'Token is missing the "codespace" scope.' };
  }
  if (!res.ok) return { status: "error", message: `Request failed (${res.status}).` };
  const data = await res.json<{
    codespaces: Array<{
      name: string;
      state: string;
      web_url: string;
      created_at: string;
      repository: { full_name: string };
    }>;
  }>();
  return {
    status: "ok",
    items: data.codespaces
      .filter((c) => c.repository.full_name === fullName)
      .map((c) => ({ name: c.name, state: c.state, webUrl: c.web_url, createdAt: c.created_at })),
  };
}

export async function createCodespace(
  owner: string,
  repo: string,
  ref: string
): Promise<{ ok: true; webUrl: string } | { ok: false; error: string }> {
  const res = await ghRequest(`/repos/${owner}/${repo}/codespaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref }),
  });
  if (!res.ok) {
    const data = await res.json<{ message?: string }>().catch(() => ({}) as { message?: string });
    return { ok: false, error: data.message ?? `Codespace creation failed (${res.status}).` };
  }
  const data = await res.json<{ web_url: string }>();
  return { ok: true, webUrl: data.web_url };
}

export function codespacesDeepLink(owner: string, repo: string, branch: string): string {
  return `https://github.com/codespaces/new?repo=${encodeURIComponent(`${owner}/${repo}`)}&ref=${encodeURIComponent(branch)}`;
}

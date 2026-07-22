import { getGithubToken } from "@/lib/github";

const API = "https://api.github.com";

export type StarredRepo = {
  fullName: string;
  owner: string;
  repo: string;
  description: string | null;
  stars: number;
  language: string | null;
  private: boolean;
  htmlUrl: string;
  updatedAt: string;
};

type RawRepo = {
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  stargazers_count: number;
  language: string | null;
  private: boolean;
  html_url: string;
  updated_at: string;
};

function headers(): Record<string, string> {
  const token = getGithubToken();
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function mapRepo(r: RawRepo): StarredRepo {
  return {
    fullName: r.full_name,
    owner: r.owner.login,
    repo: r.name,
    description: r.description,
    stars: r.stargazers_count,
    language: r.language,
    private: r.private,
    htmlUrl: r.html_url,
    updatedAt: r.updated_at,
  };
}

/**
 * Lists every repository the authenticated user has starred, newest star
 * first, following pagination in full — starred-repo lists are small
 * enough (hundreds, not tens of thousands) that a "manager" showing a
 * partial first page would be more confusing than a few extra requests.
 */
export async function listStarredRepos(): Promise<StarredRepo[]> {
  if (!getGithubToken()) {
    throw new Error(
      "No GitHub token configured — add a PAT in Settings to see your starred repositories."
    );
  }
  const all: StarredRepo[] = [];
  let page = 1;
  for (;;) {
    const res = await fetch(
      `${API}/user/starred?per_page=100&page=${page}&sort=created&direction=desc`,
      { headers: headers() }
    );
    if (!res.ok) {
      if (res.status === 401)
        throw new Error("GitHub token is invalid or missing the required scope.");
      throw new Error(`GitHub API error (${res.status}) listing starred repositories.`);
    }
    const batch = (await res.json()) as RawRepo[];
    all.push(...batch.map(mapRepo));
    if (batch.length < 100) break;
    page += 1;
    if (page > 20) break; // 2000 repos — a sane hard stop, not a real limit
  }
  return all;
}

/** Stars a repository for the authenticated user. Idempotent — starring an
 * already-starred repo succeeds without error. */
export async function starRepo(owner: string, repo: string): Promise<void> {
  const res = await fetch(`${API}/user/starred/${owner}/${repo}`, {
    method: "PUT",
    headers: { ...headers(), "Content-Length": "0" },
  });
  if (!res.ok) throw new Error(`Could not star ${owner}/${repo} (${res.status}).`);
}

/** Unstars a repository for the authenticated user. Idempotent. */
export async function unstarRepo(owner: string, repo: string): Promise<void> {
  const res = await fetch(`${API}/user/starred/${owner}/${repo}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Could not unstar ${owner}/${repo} (${res.status}).`);
}

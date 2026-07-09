export type GithubEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  sha: string;
  url: string;
};

export type RepoMeta = {
  owner: string;
  repo: string;
  fullName: string;
  branch: string;
  defaultBranch: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  private: boolean;
  htmlUrl: string;
};

const API = "https://api.github.com";

const TOKEN_KEY = "gh-browser-token";

export function getGithubToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  const t = localStorage.getItem(TOKEN_KEY);
  return t && t.trim() ? t.trim() : null;
}

export function setGithubToken(token: string): void {
  if (typeof localStorage === "undefined") return;
  if (token && token.trim()) localStorage.setItem(TOKEN_KEY, token.trim());
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearGithubToken(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

async function ghFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getGithubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      const reset = Number(res.headers.get("x-ratelimit-reset") ?? "0");
      const mins = Math.max(1, Math.round((reset * 1000 - Date.now()) / 60000));
      throw new Error(
        `GitHub API rate limit reached. Try again in about ${mins} min.`
      );
    }
    throw new Error("GitHub API request was blocked (403).");
  }

  if (res.status === 404) {
    throw new Error("Repository not found. Check owner/name and visibility.");
  }

  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}).`);
  }

  return (await res.json()) as T;
}

export type GhResponse = {
  ok: boolean;
  status: number;
  json: <T = unknown>() => Promise<T>;
  text: () => Promise<string>;
};

export async function ghRequest(
  path: string,
  init?: RequestInit
): Promise<GhResponse> {
  const token = getGithubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  return {
    ok: res.ok,
    status: res.status,
    json: async () => (await res.json()) as never,
    text: async () => await res.text(),
  };
}

export async function fetchRepoMeta(
  owner: string,
  repo: string
): Promise<RepoMeta> {
  const data = await ghFetch<{
    full_name: string;
    default_branch: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    language: string | null;
    private: boolean;
    html_url: string;
  }>(`/repos/${owner}/${repo}`);

  return {
    owner,
    repo,
    fullName: data.full_name,
    branch: data.default_branch,
    defaultBranch: data.default_branch,
    description: data.description,
    stars: data.stargazers_count,
    forks: data.forks_count,
    language: data.language,
    private: data.private,
    htmlUrl: data.html_url,
  };
}

type ContentsResponseItem = {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  sha: string;
  url: string;
};

export async function fetchContents(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<GithubEntry[]> {
  const encoded = path ? `?ref=${ref}` : `?ref=${ref}`;
  const data = await ghFetch<ContentsResponseItem[]>(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${encoded}`
  );
  return data
    .map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size,
      sha: item.sha,
      url: item.url,
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<{ content: string; size: number }> {
  const data = await ghFetch<{
    content: string;
    encoding: string;
    size: number;
    download_url: string | null;
  }>(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref}`
  );

  if (data.encoding === "base64") {
    let cleaned = data.content.replace(/\s/g, "");
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return { content: text, size: data.size };
  }

  return { content: data.content, size: data.size };
}

export async function fetchBranches(
  owner: string,
  repo: string
): Promise<string[]> {
  const data = await ghFetch<{ name: string }[]>(
    `/repos/${owner}/${repo}/branches?per_page=100`
  );
  return data.map((b) => b.name);
}

export function githubRawUrl(
  owner: string,
  repo: string,
  path: string,
  ref: string
): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
}

export function parseRepoInput(input: string): {
  owner: string;
  repo: string;
} | null {
  let value = input.trim();
  value = value.replace(/^https?:\/\/github\.com\//i, "");
  value = value.replace(/\.git$/i, "");
  value = value.replace(/\/$/, "");
  if (!value) return null;
  const parts = value.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TSX",
    js: "JavaScript",
    jsx: "JSX",
    json: "JSON",
    md: "Markdown",
    mdx: "MDX",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    py: "Python",
    rb: "Ruby",
    go: "Go",
    rs: "Rust",
    java: "Java",
    kt: "Kotlin",
    c: "C",
    h: "C",
    cpp: "C++",
    cc: "C++",
    hpp: "C++",
    cs: "C#",
    php: "PHP",
    swift: "Swift",
    sh: "Shell",
    bash: "Shell",
    zsh: "Shell",
    yml: "YAML",
    yaml: "YAML",
    toml: "TOML",
    xml: "XML",
    sql: "SQL",
    vue: "Vue",
    dockerfile: "Dockerfile",
    txt: "Text",
  };
  return map[ext] ?? (path.toLowerCase() === "dockerfile" ? "Dockerfile" : "Text");
}

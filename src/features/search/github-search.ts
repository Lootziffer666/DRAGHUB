export type SearchRepo = {
  id: number;
  fullName: string;
  owner: string;
  repo: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  updatedAt: string;
  htmlUrl: string;
};

export type ReleaseAsset = {
  name: string;
  size: number;
  downloadUrl: string;
  isApk: boolean;
  isInstaller: boolean;
};

export type ReleaseInfo = {
  tag: string;
  name: string | null;
  publishedAt: string;
  htmlUrl: string;
  assets: ReleaseAsset[];
};

const API = "https://api.github.com";

async function req<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
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
  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}).`);
  }
  return (await res.json()) as T;
}

const APK_RE = /\.apk$/i;
const INSTALLER_RE = /\.(exe|msi|dmg|deb|rpm|appimage|snap)$/i;

function assetFromRaw(a: {
  name: string;
  size: number;
  browser_download_url: string;
}): ReleaseAsset {
  return {
    name: a.name,
    size: a.size,
    downloadUrl: a.browser_download_url,
    isApk: APK_RE.test(a.name),
    isInstaller: INSTALLER_RE.test(a.name),
  };
}

type RawSearchItem = {
  id: number;
  full_name: string;
  owner: { login: string };
  name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  updated_at: string;
  html_url: string;
};

function mapRepo(i: RawSearchItem): SearchRepo {
  return {
    id: i.id,
    fullName: i.full_name,
    owner: i.owner.login,
    repo: i.name,
    description: i.description,
    stars: i.stargazers_count,
    forks: i.forks_count,
    language: i.language,
    topics: i.topics ?? [],
    updatedAt: i.updated_at,
    htmlUrl: i.html_url,
  };
}

const searchCache = new Map<string, SearchRepo[]>();

export async function searchRepositories(
  query: string,
  opts: { sort?: "stars" | "updated" | "forks"; order?: "asc" | "desc"; perPage?: number } = {}
): Promise<SearchRepo[]> {
  const q = query.trim();
  if (!q) return [];
  const perPage = opts.perPage ?? 20;
  const params = new URLSearchParams({
    q,
    per_page: String(perPage),
  });
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.order) params.set("order", opts.order);

  const key = `repos:${params.toString()}`;
  const cached = searchCache.get(key);
  if (cached) return cached;

  const data = await req<{ items: RawSearchItem[] }>(
    `/search/repositories?${params.toString()}`
  );
  const items = data.items.map(mapRepo);
  searchCache.set(key, items);
  return items;
}

export async function getRepoTopics(
  owner: string,
  repo: string
): Promise<string[]> {
  try {
    const data = await req<{ names: string[] }>(
      `/repos/${owner}/${repo}/topics`
    );
    return data.names ?? [];
  } catch {
    return [];
  }
}

export async function searchRelatedRepos(
  owner: string,
  repo: string,
  perPage = 20
): Promise<SearchRepo[]> {
  const topics = await getRepoTopics(owner, repo);
  const seed = [repo, ...topics].filter(Boolean).slice(0, 4).join(" ");
  const key = `related:${owner}/${repo}`;
  const cached = searchCache.get(key);
  if (cached) return cached;

  let results: SearchRepo[] = [];
  if (topics.length > 0) {
    const topicQuery = topics
      .slice(0, 3)
      .map((t) => `topic:${t}`)
      .join(" ");
    results = await searchRepositories(topicQuery, {
      sort: "stars",
      order: "desc",
      perPage,
    });
  } else {
    results = await searchRepositories(seed, {
      sort: "stars",
      order: "desc",
      perPage,
    });
  }
  results = results.filter((r) => r.fullName.toLowerCase() !== `${owner}/${repo}`.toLowerCase());
  searchCache.set(key, results);
  return results;
}

async function getReleases(
  owner: string,
  repo: string,
  perPage = 3
): Promise<ReleaseInfo[]> {
  try {
    const data = await req<
      {
        tag_name: string;
        name: string | null;
        published_at: string;
        html_url: string;
        assets: { name: string; size: number; browser_download_url: string }[];
      }[]
    >(`/repos/${owner}/${repo}/releases?per_page=${perPage}`);
    return data.map((r) => ({
      tag: r.tag_name,
      name: r.name,
      publishedAt: r.published_at,
      htmlUrl: r.html_url,
      assets: (r.assets ?? []).map(assetFromRaw),
    }));
  } catch {
    return [];
  }
}

export type RepoWithReleases = {
  repo: SearchRepo;
  releases: ReleaseInfo[];
  hasApk: boolean;
};

const releaseCache = new Map<string, RepoWithReleases[]>();

export async function searchReposWithReleases(
  query: string,
  perPage = 12
): Promise<RepoWithReleases[]> {
  const q = query.trim();
  if (!q) return [];
  const key = `rel:${q}:${perPage}`;
  const cached = releaseCache.get(key);
  if (cached) return cached;

  const repos = await searchRepositories(q, {
    sort: "stars",
    order: "desc",
    perPage,
  });

  const withReleases = await Promise.all(
    repos.map(async (repo) => {
      const releases = await getReleases(repo.owner, repo.repo, 3);
      return {
        repo,
        releases,
        hasApk: releases.some((r) => r.assets.some((a) => a.isApk)),
      };
    })
  );

  const result = withReleases.filter((r) => r.releases.length > 0);
  releaseCache.set(key, result);
  return result;
}

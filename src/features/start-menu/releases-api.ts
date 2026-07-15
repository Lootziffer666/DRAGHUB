import { ghRequest } from "@/lib/github";

export type ReleaseAsset = {
  name: string;
  size: number;
  downloadUrl: string;
  downloadCount: number;
};

export type Release = {
  tag: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  publishedAt: string | null;
  htmlUrl: string;
  assets: ReleaseAsset[];
};

export type ReleasesResult =
  | { status: "ok"; items: Release[] }
  | { status: "forbidden"; message: string }
  | { status: "error"; message: string };

export async function fetchReleases(owner: string, repo: string): Promise<ReleasesResult> {
  const res = await ghRequest(`/repos/${owner}/${repo}/releases?per_page=20`);
  if (res.status === 403) {
    return { status: "forbidden", message: "Token lacks access to releases for this repository." };
  }
  if (!res.ok) return { status: "error", message: `Request failed (${res.status}).` };
  const data = await res.json<
    Array<{
      tag_name: string;
      name: string | null;
      draft: boolean;
      prerelease: boolean;
      published_at: string | null;
      html_url: string;
      assets: Array<{ name: string; size: number; browser_download_url: string; download_count: number }>;
    }>
  >();
  return {
    status: "ok",
    items: data.map((r) => ({
      tag: r.tag_name,
      name: r.name,
      draft: r.draft,
      prerelease: r.prerelease,
      publishedAt: r.published_at,
      htmlUrl: r.html_url,
      assets: r.assets.map((a) => ({
        name: a.name,
        size: a.size,
        downloadUrl: a.browser_download_url,
        downloadCount: a.download_count,
      })),
    })),
  };
}

export type PackageInfo = { name: string; packageType: string; htmlUrl: string };

export type PackagesResult =
  | { status: "ok"; items: PackageInfo[] }
  | { status: "forbidden"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

/** Packages are scoped to the owner (user or org), not the repo — GitHub
 * has no "packages for this repo" list endpoint, so this asks per common
 * package type and filters by repository name client-side. */
export async function fetchPackages(owner: string, repo: string): Promise<PackagesResult> {
  const types = ["npm", "container", "maven", "docker", "nuget", "rubygems"];
  const found: PackageInfo[] = [];
  let anyForbidden = false;
  let anyOk = false;
  for (const type of types) {
    const res = await ghRequest(`/users/${owner}/packages?package_type=${type}&per_page=50`);
    if (res.status === 403) {
      anyForbidden = true;
      continue;
    }
    if (!res.ok) continue;
    anyOk = true;
    const data = await res.json<
      Array<{ name: string; package_type: string; repository: { name: string } | null; html_url: string }>
    >();
    for (const p of data) {
      if (p.repository?.name === repo) {
        found.push({ name: p.name, packageType: p.package_type, htmlUrl: p.html_url });
      }
    }
  }
  if (found.length > 0) return { status: "ok", items: found };
  if (anyForbidden && !anyOk) {
    return { status: "forbidden", message: 'Token is missing "read:packages" scope.' };
  }
  return { status: "unavailable", message: "No packages found for this repository." };
}

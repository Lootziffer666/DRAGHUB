import { ghRequest } from "@/lib/github";

export type PullRequestSummary = {
  number: number; title: string; state: string; htmlUrl: string; user: string; labels: string[];
  draft: boolean; mergeable: boolean | null; additions: number; deletions: number; changedFiles: number; bodyLength: number; createdAt: string;
};

export async function listPulls(owner: string, repo: string): Promise<PullRequestSummary[]> {
  const res = await ghRequest(`/repos/${owner}/${repo}/pulls?state=open&per_page=30`);
  if (!res.ok) throw new Error(`Pull requests unavailable (${res.status}).`);
  const data = await res.json<Array<{ number:number; title:string; state:string; html_url:string; user?:{login:string}; labels:Array<{name:string}>; draft:boolean; body:string|null; created_at:string }>>();
  return Promise.all(data.map(async (pr) => {
    const detail = await ghRequest(`/repos/${owner}/${repo}/pulls/${pr.number}`);
    const d = detail.ok ? await detail.json<{ mergeable:boolean|null; additions:number; deletions:number; changed_files:number }>() : null;
    return { number: pr.number, title: pr.title, state: pr.state, htmlUrl: pr.html_url, user: pr.user?.login ?? "unknown", labels: pr.labels.map(l=>l.name), draft: pr.draft, mergeable: d?.mergeable ?? null, additions: d?.additions ?? 0, deletions: d?.deletions ?? 0, changedFiles: d?.changed_files ?? 0, bodyLength: pr.body?.trim().length ?? 0, createdAt: pr.created_at };
  }));
}

export async function mergePull(owner:string, repo:string, number:number): Promise<void> { const res=await ghRequest(`/repos/${owner}/${repo}/pulls/${number}/merge`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({merge_method:"merge"})}); if(!res.ok) throw new Error(`Merge failed (${res.status}).`); }
export async function closePull(owner:string, repo:string, number:number): Promise<void> { const res=await ghRequest(`/repos/${owner}/${repo}/pulls/${number}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({state:"closed"})}); if(!res.ok) throw new Error(`Close failed (${res.status}).`); }

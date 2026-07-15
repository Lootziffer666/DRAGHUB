import { ghRequest } from "@/lib/github";

export type AlertResult<T> =
  | { status: "ok"; items: T[] }
  | { status: "forbidden"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

export type DependabotAlert = {
  number: number;
  state: string;
  severity: string;
  packageName: string;
  summary: string;
  htmlUrl: string;
};

export type CodeScanningAlert = {
  number: number;
  state: string;
  severity: string;
  rule: string;
  htmlUrl: string;
};

export type SecretScanningAlert = {
  number: number;
  state: string;
  secretType: string;
  htmlUrl: string;
};

async function fetchAlerts<T>(
  path: string,
  requiredScope: string,
  map: (raw: unknown) => T
): Promise<AlertResult<T>> {
  const res = await ghRequest(`${path}?state=open&per_page=100`);
  if (res.status === 403) {
    return {
      status: "forbidden",
      message: `Token is missing the "${requiredScope}" scope (or this repo restricts access to it).`,
    };
  }
  if (res.status === 404) {
    return {
      status: "unavailable",
      message: "Not available — either this feature isn't enabled for the repository, or your token lacks the required permission.",
    };
  }
  if (!res.ok) {
    return { status: "error", message: `Request failed (${res.status}).` };
  }
  const data = await res.json<unknown[]>();
  return { status: "ok", items: data.map(map) };
}

export function fetchDependabotAlerts(owner: string, repo: string) {
  return fetchAlerts<DependabotAlert>(
    `/repos/${owner}/${repo}/dependabot/alerts`,
    "security_events / Dependabot alerts: read",
    (raw) => {
      const a = raw as {
        number: number;
        state: string;
        security_advisory: { severity: string; summary: string };
        dependency: { package: { name: string } };
        html_url: string;
      };
      return {
        number: a.number,
        state: a.state,
        severity: a.security_advisory.severity,
        packageName: a.dependency.package.name,
        summary: a.security_advisory.summary,
        htmlUrl: a.html_url,
      };
    }
  );
}

export function fetchCodeScanningAlerts(owner: string, repo: string) {
  return fetchAlerts<CodeScanningAlert>(
    `/repos/${owner}/${repo}/code-scanning/alerts`,
    "security_events / Code scanning alerts: read",
    (raw) => {
      const a = raw as {
        number: number;
        state: string;
        rule: { id: string; severity: string };
        html_url: string;
      };
      return {
        number: a.number,
        state: a.state,
        severity: a.rule.severity ?? "unknown",
        rule: a.rule.id,
        htmlUrl: a.html_url,
      };
    }
  );
}

export function fetchSecretScanningAlerts(owner: string, repo: string) {
  return fetchAlerts<SecretScanningAlert>(
    `/repos/${owner}/${repo}/secret-scanning/alerts`,
    "secret_scanning_alerts: read",
    (raw) => {
      const a = raw as { number: number; state: string; secret_type: string; html_url: string };
      return {
        number: a.number,
        state: a.state,
        secretType: a.secret_type,
        htmlUrl: a.html_url,
      };
    }
  );
}

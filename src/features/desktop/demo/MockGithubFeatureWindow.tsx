import type { WindowContentProps } from "../types";
export function MockGithubFeatureWindow({ resource }: WindowContentProps) {
  const feature =
    resource.type === "github-feature" ? resource.featureId : "feature";
  const repo = resource.type === "github-feature" ? resource.repoKey : "Demo";
  return (
    <div className="mock-panel">
      <span className="demo-pill">MOCK · NO API CONNECTION</span>
      <h2>{feature.replaceAll("-", " ")}</h2>
      <p>{repo}</p>
      {["Queued workflow", "Build and test", "Package artifacts"].map(
        (x, i) => (
          <div className="mock-row" key={x}>
            <i className={i === 1 ? "pulse" : ""} />
            <span>
              <b>{x}</b>
              <small>Simulated repository activity</small>
            </span>
            <strong>{i === 0 ? "waiting" : "demo"}</strong>
          </div>
        ),
      )}
    </div>
  );
}

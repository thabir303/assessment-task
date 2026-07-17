const implementationPhases = [
  "Convex schema and local frontend shell",
  "Daytona VM provisioning",
  "Pi runner inside the VM",
  "Streaming event bridge and observability"
];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Agentic Institute assessment</p>
        <h1 id="page-title">Pi in an isolated Daytona VM</h1>
        <p className="lede">
          The architecture harness is ready. Product behavior is intentionally deferred until each verified feature slice is implemented.
        </p>
      </section>

      <section className="card" aria-labelledby="boundary-title">
        <h2 id="boundary-title">Non-negotiable boundary</h2>
        <dl className="boundary-grid">
          <div>
            <dt>Control plane</dt>
            <dd>Next.js and Convex orchestrate, persist projections, and serve the UI.</dd>
          </div>
          <div>
            <dt>Execution plane</dt>
            <dd>Pi and all tools run inside one dedicated Daytona VM per thread.</dd>
          </div>
        </dl>
      </section>

      <section className="card" aria-labelledby="roadmap-title">
        <h2 id="roadmap-title">Next implementation slices</h2>
        <ol className="phase-list">
          {implementationPhases.map((phase) => (
            <li key={phase}>{phase}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}

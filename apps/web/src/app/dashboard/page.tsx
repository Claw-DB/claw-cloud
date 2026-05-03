// Dashboard home page — workspace overview showing instances, usage, and quick actions
export default function DashboardPage() {
  return (
    <section className="page">
      <header className="hero">
        <span className="badge">Workspace: Acme Labs</span>
        <h1>Control Plane</h1>
        <p>Monitor instance health, spend velocity, and platform events in one place.</p>
      </header>

      <div className="grid">
        <article className="card span-4">
          <h3>Running Instances</h3>
          <div className="kpi">8</div>
          <p>2 pending upgrades</p>
        </article>
        <article className="card span-4">
          <h3>Monthly Spend</h3>
          <div className="kpi">$1,248</div>
          <p>14% below forecast</p>
        </article>
        <article className="card span-4">
          <h3>p95 Query Latency</h3>
          <div className="kpi">42ms</div>
          <p>Healthy across all regions</p>
        </article>

        <article className="card span-8">
          <h3>Region Footprint</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Region</th>
                <th>Instances</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>US East</td>
                <td>4</td>
                <td>Nominal</td>
              </tr>
              <tr>
                <td>EU West</td>
                <td>3</td>
                <td>Nominal</td>
              </tr>
              <tr>
                <td>APAC East</td>
                <td>1</td>
                <td>Scaling</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article className="card span-4">
          <h3>Recent Incidents</h3>
          <p>No active incidents. Last issue resolved 2 days ago.</p>
        </article>
      </div>
    </section>
  );
}

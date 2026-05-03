// Admin dashboard home — overview of all tenants, instances, and platform health
export default function AdminHomePage() {
  return (
    <section>
      <article className="panel">
        <h1>Platform Overview</h1>
        <p>Real-time operating summary across tenants, regions, and background workers.</p>
      </article>
      <article className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Active Tenants</td>
              <td>1,942</td>
              <td>Healthy</td>
            </tr>
            <tr>
              <td>Running Instances</td>
              <td>6,310</td>
              <td>Healthy</td>
            </tr>
            <tr>
              <td>Queue Backlog</td>
              <td>122 jobs</td>
              <td>Watch</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
  );
}

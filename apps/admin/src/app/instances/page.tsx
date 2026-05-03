export default function AdminInstancesPage() {
  return (
    <section>
      <article className="panel">
        <h1>Global Instances</h1>
        <p>Track placement, saturation, and noisy-neighbor anomalies.</p>
      </article>
      <article className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Instance</th>
              <th>Workspace</th>
              <th>Tier</th>
              <th>Node</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>orders-primary</td>
              <td>acme-labs</td>
              <td>MEDIUM</td>
              <td>aks-us-03</td>
              <td>RUNNING</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
  );
}

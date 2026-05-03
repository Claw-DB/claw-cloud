export default function TenantsPage() {
  return (
    <section>
      <article className="panel">
        <h1>Tenants</h1>
        <p>Inspect plan status, suspensions, and account risk indicators.</p>
      </article>
      <article className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Workspace</th>
              <th>Plan</th>
              <th>Region</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>acme-labs</td>
              <td>PRO</td>
              <td>US East</td>
              <td>ACTIVE</td>
            </tr>
            <tr>
              <td>globex-data</td>
              <td>STARTER</td>
              <td>EU West</td>
              <td>ACTIVE</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
  );
}

export default function IncidentsPage() {
  return (
    <section>
      <article className="panel">
        <h1>Incident Console</h1>
        <p>Review active incidents and mitigation timelines.</p>
      </article>
      <article className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Severity</th>
              <th>Summary</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>INC-1049</td>
              <td>P2</td>
              <td>Billing webhook retries elevated in eu-west</td>
              <td>platform-oncall</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
  );
}

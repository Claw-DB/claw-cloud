// Instances management page — list and manage hosted ClawDB instances
export default function InstancesPage() {
  return (
    <section className="page">
      <header className="hero">
        <h1>Instances</h1>
        <p>Provision, scale, and inspect ClawDB instances by region and service tier.</p>
      </header>
      <article className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Region</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Endpoint</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>orders-primary</td>
              <td>us-east</td>
              <td>MEDIUM</td>
              <td>RUNNING</td>
              <td>grpc://orders-primary...</td>
            </tr>
            <tr>
              <td>analytics-eu</td>
              <td>eu-west</td>
              <td>LARGE</td>
              <td>RUNNING</td>
              <td>grpc://analytics-eu...</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
  );
}

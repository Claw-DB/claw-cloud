// Team management page — members, invitations, and role assignments
export default function TeamPage() {
  return (
    <section className="page">
      <header className="hero">
        <h1>Team</h1>
        <p>Control member access, invitations, and role assignments.</p>
      </header>
      <article className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Jane Doe</td>
              <td>jane@acme.com</td>
              <td>OWNER</td>
            </tr>
            <tr>
              <td>Alex Yu</td>
              <td>alex@acme.com</td>
              <td>DEVELOPER</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
  );
}

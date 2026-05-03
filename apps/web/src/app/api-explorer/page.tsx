// API Explorer page — interactive ClawDB API playground for testing queries
export default function ApiExplorerPage() {
  return (
    <section className="page">
      <header className="hero">
        <h1>API Explorer</h1>
        <p>Test authenticated API routes and capture exact request/response payloads.</p>
      </header>
      <article className="card">
        <h3>Sample Request</h3>
        <pre>{`GET /instances\nAuthorization: Bearer ********\nX-Workspace-Id: ws_123`}</pre>
      </article>
    </section>
  );
}

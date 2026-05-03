// Settings page — workspace settings, API keys, and webhook configuration
export default function SettingsPage() {
  return (
    <section className="page">
      <header className="hero">
        <h1>Settings</h1>
        <p>Manage workspace identity, API keys, webhooks, and access control.</p>
      </header>
      <div className="grid">
        <article className="card span-6">
          <h3>API Keys</h3>
          <p>2 active keys, 1 rotation pending.</p>
        </article>
        <article className="card span-6">
          <h3>Webhooks</h3>
          <p>4 endpoints enabled, 100% delivery over 24h.</p>
        </article>
      </div>
    </section>
  );
}

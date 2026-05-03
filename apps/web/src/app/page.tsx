import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="page">
      <header className="hero">
        <span className="badge">Managed ClawDB</span>
        <h1>Operate stateful workloads with confidence.</h1>
        <p>Provision globally, automate backups, and monitor usage in a single cloud console.</p>
        <p>
          <Link href="/dashboard">Open Dashboard</Link>
        </p>
      </header>
    </section>
  );
}

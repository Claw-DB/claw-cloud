// Login page — email/password login form with OAuth and magic-link options
export default function LoginPage() {
  return (
    <section className="page">
      <article className="card">
        <h1>Sign In</h1>
        <form method="POST" action="/api/auth/login" className="stack">
          <input type="email" name="email" placeholder="Email" required />
          <input type="password" name="password" placeholder="Password" required />
          <button type="submit">Sign In</button>
        </form>
      </article>
    </section>
  );
}

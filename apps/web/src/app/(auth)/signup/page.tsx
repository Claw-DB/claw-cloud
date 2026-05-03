// Signup page — new user registration form
export default function SignupPage() {
  return (
    <section className="page">
      <article className="card">
        <h1>Create your account</h1>
        <form method="POST" action="/api/auth/register" className="stack">
          <input type="text" name="name" placeholder="Full Name" required />
          <input type="email" name="email" placeholder="Email" required />
          <input type="password" name="password" placeholder="Password (min 8 chars)" required />
          <button type="submit">Create Account</button>
        </form>
      </article>
    </section>
  );
}

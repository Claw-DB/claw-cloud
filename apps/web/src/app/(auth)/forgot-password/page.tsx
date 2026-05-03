// Forgot password page — email input to trigger password reset flow
export default function ForgotPasswordPage() {
  return (
    <section className="page">
      <article className="card">
        <h1>Reset your password</h1>
        <form method="POST" action="/api/auth/forgot-password" className="stack">
          <input type="email" name="email" placeholder="Email" required />
          <button type="submit">Send Reset Link</button>
        </form>
      </article>
    </section>
  );
}

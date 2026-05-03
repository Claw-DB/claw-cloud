// Login page — email/password login form with OAuth and magic-link options
export default function LoginPage() {
  return (
    <main>
      <h1>Sign In to Claw Cloud</h1>
      <form method="POST" action="/api/auth/login">
        <input type="email" name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit">Sign In</button>
      </form>
    </main>
  );
}

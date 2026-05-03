// Signup page — new user registration form
export default function SignupPage() {
  return (
    <main>
      <h1>Create your Claw Cloud account</h1>
      <form method="POST" action="/api/auth/register">
        <input type="text" name="name" placeholder="Full Name" required />
        <input type="email" name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password (min 8 chars)" required />
        <button type="submit">Create Account</button>
      </form>
    </main>
  );
}

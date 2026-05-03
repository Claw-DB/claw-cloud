// Forgot password page — email input to trigger password reset flow
export default function ForgotPasswordPage() {
  return (
    <main>
      <h1>Reset your password</h1>
      <form method="POST" action="/api/auth/forgot-password">
        <input type="email" name="email" placeholder="Email" required />
        <button type="submit">Send Reset Link</button>
      </form>
    </main>
  );
}

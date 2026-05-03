// Magic-link page — email input for passwordless authentication
export default function MagicLinkPage() {
  return (
    <main>
      <h1>Sign in with a magic link</h1>
      <form method="POST" action="/api/auth/magic-link">
        <input type="email" name="email" placeholder="Email" required />
        <button type="submit">Send Magic Link</button>
      </form>
    </main>
  );
}

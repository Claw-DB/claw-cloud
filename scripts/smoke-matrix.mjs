const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const now = Date.now();
const email = `smoke.${now}@example.com`;
const password = 'SmokePass123!';
const results = [];

async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ flow: name, status: 'PASS', detail });
  } catch (err) {
    results.push({ flow: name, status: 'FAIL', detail: err.message || String(err) });
  }
}

async function req(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message = data && data.message ? data.message : `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data;
}

let accessToken = '';
let workspaceId = '';
let instanceId = '';
let apiKeyId = '';
let webhookId = '';

await step('signup', async () => {
  const out = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name: 'Smoke User' }),
  });
  accessToken = out?.tokens?.accessToken || '';
  if (!accessToken) throw new Error('Missing access token from register');
  return 'registered + token issued';
});

await step('login', async () => {
  const out = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  accessToken = out?.tokens?.accessToken || accessToken;
  if (!accessToken) throw new Error('Missing access token from login');
  return 'authenticated';
});

await step('onboarding', async () => {
  const ws = await req('/workspaces', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name: `Smoke Workspace ${now}`, slug: `smoke-${now}` }),
  });
  workspaceId = ws.id;
  if (!workspaceId) throw new Error('Workspace creation returned no id');
  return `workspace ${workspaceId}`;
});

await step('instances', async () => {
  const created = await req(`/workspaces/${workspaceId}/instances`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name: 'smoke-instance', region: 'US_EAST', tier: 'NANO', version: 'latest' }),
  });
  instanceId = created.id;
  const list = await req(`/workspaces/${workspaceId}/instances`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return `created=${Boolean(instanceId)} listed=${Array.isArray(list) ? list.length : 0}`;
});

await step('api-keys', async () => {
  const created = await req(`/workspaces/${workspaceId}/api-keys`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name: 'smoke-key', scopes: ['read:memory'] }),
  });
  apiKeyId = created?.apiKey?.id;
  const list = await req(`/workspaces/${workspaceId}/api-keys`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return `created=${Boolean(apiKeyId)} listed=${Array.isArray(list) ? list.length : 0}`;
});

await step('team', async () => {
  const members = await req(`/workspaces/${workspaceId}/members`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return `members=${Array.isArray(members) ? members.length : 0}`;
});

await step('invite', async () => {
  const out = await req(`/workspaces/${workspaceId}/members/invite`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ email: `invite.${now}@example.com`, role: 'DEVELOPER' }),
  });
  return `invitation=${out?.id ? 'created' : 'missing-id'}`;
});

await step('webhook', async () => {
  const created = await req(`/workspaces/${workspaceId}/webhooks`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      url: 'https://example.com/webhook',
      events: ['instance.created'],
      enabled: true,
    }),
  });
  webhookId = created?.id;
  const list = await req(`/workspaces/${workspaceId}/webhooks`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return `created=${Boolean(webhookId)} listed=${Array.isArray(list) ? list.length : 0}`;
});

await step('sync', async () => {
  const list = await req(`/workspaces/${workspaceId}/replication/links`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return `links=${Array.isArray(list) ? list.length : 0}`;
});

await step('billing', async () => {
  const checkout = await req('/billing/checkout', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      workspaceId,
      plan: 'STARTER',
      successUrl: 'http://localhost:3000/dashboard/billing?upgraded=1',
      cancelUrl: 'http://localhost:3000/dashboard/billing',
    }),
  });
  if (!checkout?.url) {
    throw new Error('Missing checkout URL');
  }
  return `checkoutUrl=true`;
});

await step('settings', async () => {
  const me = await req('/auth/me', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const updated = await req(`/workspaces/${workspaceId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name: `Smoke Workspace ${now} Updated` }),
  });
  return `user=${me?.id ? 'ok' : 'missing'} workspaceUpdated=${updated?.name ? 'ok' : 'missing'}`;
});

console.log(JSON.stringify({ base, email, workspaceId, results }, null, 2));

'use client';

import * as React from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Topbar } from '@/components/layout/topbar';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/utils';
import { Terminal, Code2, Bot, Puzzle, ArrowRight, Package } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
type PackageManager = 'npm' | 'pnpm' | 'yarn';
type Language = 'typescript' | 'python' | 'go';

// ── Install commands ───────────────────────────────────────────────────────────
const INSTALL_COMMANDS: Record<PackageManager, string> = {
  npm: 'npm install @claw-cloud/sdk',
  pnpm: 'pnpm add @claw-cloud/sdk',
  yarn: 'yarn add @claw-cloud/sdk',
};

// ── SDK Quick-start code examples ─────────────────────────────────────────────
const SDK_EXAMPLES: Record<Language, string> = {
  typescript: `import { ClawClient } from '@claw-cloud/sdk';

const client = new ClawClient({
  apiKey: process.env.CLAW_API_KEY!,
  instanceId: 'your-instance-id',
});

// Connect to your instance
await client.connect();

// Basic key-value operations
await client.set('session:user:123', JSON.stringify({
  userId: '123',
  email: 'user@example.com',
  expiresAt: Date.now() + 3600_000,
}), { ttl: 3600 });

const raw = await client.get('session:user:123');
const session = raw ? JSON.parse(raw) : null;

// Pattern-based scan
const sessionKeys = await client.scan('session:user:*');

// Atomic increment for counters
const views = await client.incr('pageviews:home');

// Pub/Sub
await client.subscribe('events:orders', (msg) => {
  console.log('New order:', msg);
});

await client.publish('events:orders', JSON.stringify({ orderId: 'ord_001' }));

await client.disconnect();`,

  python: `from claw_cloud import ClawClient
import json, os

client = ClawClient(
    api_key=os.environ["CLAW_API_KEY"],
    instance_id="your-instance-id",
)

# Connect to your instance
client.connect()

# Basic key-value operations
client.set(
    "session:user:123",
    json.dumps({"userId": "123", "email": "user@example.com"}),
    ttl=3600,
)

raw = client.get("session:user:123")
session = json.loads(raw) if raw else None

# Pattern-based scan
session_keys = client.scan("session:user:*")

# Atomic increment
views = client.incr("pageviews:home")

# Pub/Sub
def handle_order(msg):
    print("New order:", msg)

client.subscribe("events:orders", handle_order)
client.publish("events:orders", json.dumps({"orderId": "ord_001"}))

client.disconnect()`,

  go: `package main

import (
    "context"
    "encoding/json"
    "fmt"
    "os"

    claw "github.com/claw-cloud/sdk-go"
)

func main() {
    client := claw.NewClient(claw.Config{
        APIKey:     os.Getenv("CLAW_API_KEY"),
        InstanceID: "your-instance-id",
    })

    ctx := context.Background()

    if err := client.Connect(ctx); err != nil {
        panic(err)
    }
    defer client.Disconnect()

    // Basic key-value operations
    payload, _ := json.Marshal(map[string]string{
        "userId": "123",
        "email":  "user@example.com",
    })
    client.Set(ctx, "session:user:123", string(payload), claw.SetOpts{TTL: 3600})

    raw, _ := client.Get(ctx, "session:user:123")
    fmt.Println("Session:", raw)

    // Atomic increment
    views, _ := client.Incr(ctx, "pageviews:home")
    fmt.Println("Views:", views)

    // Pub/Sub
    client.Subscribe(ctx, "events:orders", func(msg string) {
        fmt.Println("New order:", msg)
    })
}`,
};

// ── Claude Desktop MCP config ──────────────────────────────────────────────────
const MCP_CONFIG = `{
  "mcpServers": {
    "claw-cloud": {
      "command": "npx",
      "args": ["-y", "@claw-cloud/mcp-server"],
      "env": {
        "CLAW_API_KEY": "YOUR_API_KEY_HERE",
        "CLAW_INSTANCE_ID": "YOUR_INSTANCE_ID_HERE"
      }
    }
  }
}`;

const MCP_CLAUDE_PATH_MAC = '~/Library/Application Support/Claude/claude_desktop_config.json';
const MCP_CLAUDE_PATH_WIN = '%APPDATA%\\Claude\\claude_desktop_config.json';

// ── Tab button ─────────────────────────────────────────────────────────────────
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
        active ? 'bg-accent text-white' : 'text-ink-3 hover:text-ink hover:bg-bg-3',
      )}
    >
      {children}
    </button>
  );
}

// ── Code block ─────────────────────────────────────────────────────────────────
function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-3 rounded-t-lg">
        <span className="text-xs text-ink-3 font-mono">{language}</span>
        <CopyButton value={code} />
      </div>
      <pre className="p-4 overflow-x-auto bg-bg-2 rounded-b-lg text-xs font-mono text-ink-2 leading-relaxed max-h-96 overflow-y-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({
  icon,
  title,
  description,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/20 shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          {badge && <Badge variant="info">{badge}</Badge>}
        </div>
        <p className="text-sm text-ink-3 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const [pkgManager, setPkgManager] = React.useState<PackageManager>('npm');
  const [language, setLanguage] = React.useState<Language>('typescript');

  return (
    <DashboardLayout>
      <Topbar title="Integrations" />
      <PageWrapper>
        <div className="space-y-8">

          <Card>
            <CardBody>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-3">Jump to:</span>
                <a href="#sdk" className="px-2.5 py-1 rounded bg-bg-3 text-ink hover:text-accent">SDK</a>
                <a href="#rest-api" className="px-2.5 py-1 rounded bg-bg-3 text-ink hover:text-accent">REST API</a>
                <a href="#mcp" className="px-2.5 py-1 rounded bg-bg-3 text-ink hover:text-accent">Claude MCP</a>
                <a href="#more-integrations" className="px-2.5 py-1 rounded bg-bg-3 text-ink hover:text-accent">Ecosystem</a>
              </div>
            </CardBody>
          </Card>

          {/* SDK Installation */}
          <Card id="sdk">
            <CardHeader>
              <SectionHeader
                icon={<Package className="w-5 h-5 text-accent" />}
                title="Claw Cloud SDK"
                description="Official client library for JavaScript / TypeScript, Python, and Go."
              />
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Package manager tabs */}
              <div>
                <div className="text-xs font-medium text-ink-3 mb-2 uppercase tracking-wider">Install</div>
                <div className="flex gap-1.5 mb-3 bg-bg-3 rounded-lg p-1 w-fit">
                  {(['npm', 'pnpm', 'yarn'] as PackageManager[]).map((pm) => (
                    <TabButton key={pm} active={pkgManager === pm} onClick={() => setPkgManager(pm)}>
                      {pm}
                    </TabButton>
                  ))}
                </div>
                <div className="flex items-center gap-3 px-4 py-3 bg-bg-2 border border-border rounded-lg font-mono text-sm">
                  <Terminal className="w-4 h-4 text-accent shrink-0" />
                  <code className="text-ink flex-1">{INSTALL_COMMANDS[pkgManager]}</code>
                  <CopyButton value={INSTALL_COMMANDS[pkgManager]} />
                </div>
              </div>

              {/* Language tabs */}
              <div>
                <div className="text-xs font-medium text-ink-3 mb-2 uppercase tracking-wider">Quick start</div>
                <div className="flex gap-1.5 mb-3 bg-bg-3 rounded-lg p-1 w-fit">
                  {(['typescript', 'python', 'go'] as Language[]).map((lang) => (
                    <TabButton key={lang} active={language === lang} onClick={() => setLanguage(lang)}>
                      {lang === 'typescript' ? 'TypeScript' : lang === 'python' ? 'Python' : 'Go'}
                    </TabButton>
                  ))}
                </div>
                <CodeBlock
                  code={SDK_EXAMPLES[language]}
                  language={language === 'typescript' ? 'TypeScript' : language === 'python' ? 'Python' : 'Go'}
                />
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-3 pt-2">
                {[
                  { label: 'npm package', href: 'https://npmjs.com/package/@claw-cloud/sdk' },
                  { label: 'GitHub repo', href: 'https://github.com/claw-cloud/sdk-js' },
                  { label: 'Full API reference', href: '/api-explorer' },
                ].map(({ label, href }) => (
                  <a
                    key={label}
                    href={href}
                    className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                  >
                    {label}
                    <ArrowRight className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* REST API */}
          <Card id="rest-api">
            <CardHeader>
              <SectionHeader
                icon={<Code2 className="w-5 h-5 text-accent" />}
                title="REST API"
                description="Access any Claw Cloud feature directly via HTTP with your API key."
              />
            </CardHeader>
            <CardBody className="space-y-4">
              <CodeBlock
                language="cURL"
                code={`# Set a key
curl -X POST https://api.clawdb.dev/v1/kv/set \\
  -H "Authorization: Bearer $CLAW_API_KEY" \\
  -H "X-Instance-Id: $CLAW_INSTANCE_ID" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "session:user:123", "value": "...", "ttl": 3600}'

# Get a key
curl https://api.clawdb.dev/v1/kv/get/session:user:123 \\
  -H "Authorization: Bearer $CLAW_API_KEY" \\
  -H "X-Instance-Id: $CLAW_INSTANCE_ID"

# Delete a key
curl -X DELETE https://api.clawdb.dev/v1/kv/del/session:user:123 \\
  -H "Authorization: Bearer $CLAW_API_KEY" \\
  -H "X-Instance-Id: $CLAW_INSTANCE_ID"`}
              />
              <a
                href="/api-explorer"
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                Explore full API in interactive docs
                <ArrowRight className="w-3 h-3" />
              </a>
            </CardBody>
          </Card>

          {/* Claude Desktop MCP */}
          <Card id="mcp">
            <CardHeader>
              <SectionHeader
                icon={<Bot className="w-5 h-5 text-accent" />}
                title="Claude Desktop (MCP)"
                description="Connect Claude Desktop to your Claw Cloud instances via the Model Context Protocol."
                badge="MCP"
              />
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm text-ink-2">
                  The Claw Cloud MCP server lets Claude read and write to your memory instances
                  directly from your desktop conversations — great for building AI-powered workflows
                  that need persistent context.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg bg-bg-3 border border-border text-sm">
                  {[
                    { icon: '🤖', text: 'Works with Claude Desktop 0.7+' },
                    { icon: '🔒', text: 'Scoped to a single API key' },
                    { icon: '⚡', text: 'Zero-latency local reads' },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center gap-2 text-ink-2">
                      <span>{icon}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 1 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <span className="text-sm font-medium text-ink">Open your Claude Desktop config</span>
                </div>
                <div className="ml-8 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-ink-3 font-mono bg-bg-3 px-3 py-2 rounded border border-border">
                    <span className="text-ink-2">macOS:</span>
                    <code>{MCP_CLAUDE_PATH_MAC}</code>
                    <CopyButton value={MCP_CLAUDE_PATH_MAC} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-3 font-mono bg-bg-3 px-3 py-2 rounded border border-border">
                    <span className="text-ink-2">Windows:</span>
                    <code>{MCP_CLAUDE_PATH_WIN}</code>
                    <CopyButton value={MCP_CLAUDE_PATH_WIN} />
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <span className="text-sm font-medium text-ink">Add the Claw Cloud MCP server config</span>
                </div>
                <div className="ml-8">
                  <CodeBlock code={MCP_CONFIG} language="JSON" />
                  <p className="text-xs text-ink-3 mt-2">
                    Replace <code className="font-mono text-accent">YOUR_API_KEY_HERE</code> and{' '}
                    <code className="font-mono text-accent">YOUR_INSTANCE_ID_HERE</code> with your actual credentials from the{' '}
                    <a href="/dashboard/api-keys" className="text-accent hover:underline">API Keys</a> page.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <span className="text-sm font-medium text-ink">Restart Claude Desktop</span>
                </div>
                <p className="ml-8 text-sm text-ink-3">
                  Claude will automatically detect the MCP server and show a{' '}
                  <strong className="text-ink">Claw Cloud</strong> tool in the toolbar.
                  You can then ask Claude to read, write, or scan your memory instances.
                </p>
              </div>

              {/* Example usage */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-ink-3 uppercase tracking-wider">Example prompts</div>
                <div className="space-y-2">
                  {[
                    '"Store this JSON under key user:profile:123 with a 24-hour TTL"',
                    '"What keys match the pattern session:*?"',
                    '"Delete all keys older than 7 days matching cache:page:*"',
                  ].map((p) => (
                    <div key={p} className="flex items-start gap-2 p-3 rounded-lg bg-bg-3 border border-border">
                      <Bot className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <p className="text-sm text-ink-2 italic">{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* More integrations */}
          <Card id="more-integrations">
            <CardHeader>
              <SectionHeader
                icon={<Puzzle className="w-5 h-5 text-accent" />}
                title="More integrations"
                description="Connect Claw Cloud to your existing stack."
              />
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { name: 'Vercel', status: 'available', icon: '▲' },
                  { name: 'Netlify', status: 'available', icon: '🌐' },
                  { name: 'Railway', status: 'available', icon: '🚂' },
                  { name: 'Fly.io', status: 'available', icon: '🪰' },
                  { name: 'Next.js', status: 'available', icon: '⬜' },
                  { name: 'LangChain', status: 'available', icon: '🔗' },
                  { name: 'Datadog', status: 'coming-soon', icon: '🐕' },
                  { name: 'Grafana', status: 'coming-soon', icon: '📊' },
                ].map(({ name, status, icon }) => (
                  <div
                    key={name}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bg-2 hover:bg-bg-3 transition-colors"
                  >
                    <span className="text-xl">{icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{name}</div>
                      {status === 'coming-soon' && (
                        <div className="text-xs text-ink-3">Coming soon</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

        </div>
      </PageWrapper>
    </DashboardLayout>
  );
}

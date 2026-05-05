'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, Loader2, Server, Key, Wifi, AlertCircle } from 'lucide-react';
import { Button, Input, Select, Card, CardBody, CodeSnippet } from '@/components/ui';
import { cn } from '@/lib/utils';
import { workspaceApi, instanceApi, apiKeyApi } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useWorkspace } from '@/app/providers';

type Step = 'workspace' | 'instance' | 'provisioning' | 'done';

interface StepDef { id: Step; label: string }

const STEPS: StepDef[] = [
  { id: 'workspace',    label: 'Workspace' },
  { id: 'instance',     label: 'Instance' },
  { id: 'provisioning', label: 'Provisioning' },
  { id: 'done',         label: 'Done' },
];

const REGIONS = [
  { value: 'US_EAST',    label: '🇺🇸 US East (N. Virginia)' },
  { value: 'US_WEST',    label: '🇺🇸 US West (Oregon)' },
  { value: 'EU_WEST',    label: '🇮🇪 EU West (Ireland)' },
  { value: 'EU_CENTRAL', label: '🇩🇪 EU Central (Frankfurt)' },
  { value: 'APAC_EAST',  label: '🇯🇵 APAC East (Tokyo)' },
];

const TIERS = [
  { value: 'NANO',   label: 'Nano',   desc: '0.25 vCPU · 50 MB mem · 100 MB storage', free: true },
  { value: 'MICRO',  label: 'Micro',  desc: '0.5 vCPU · 512 MB mem · 5 GB storage',   free: false },
  { value: 'SMALL',  label: 'Small',  desc: '1 vCPU · 1 GB mem · 20 GB storage',       free: false },
  { value: 'MEDIUM', label: 'Medium', desc: '2 vCPU · 2 GB mem · 50 GB storage',       free: false },
];

const PROVISION_MESSAGES = [
  'Allocating resources…',
  'Bootstrapping container…',
  'Configuring TLS certificate…',
  'Running health checks…',
  'Finalizing endpoint…',
];

// ── Step Indicator ─────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, idx) => {
        const isDone   = idx < currentIdx;
        const isActive = idx === currentIdx;
        return (
          <React.Fragment key={step.id}>
            {idx > 0 && (
              <div className={cn('h-px w-8 transition-colors duration-500', isDone ? 'bg-accent' : 'bg-border')} />
            )}
            <div className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300',
              isDone   ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
              isActive ? 'bg-accent text-white ring-4 ring-accent/20' :
                         'bg-bg-2 text-ink-3 border border-border',
            )}>
              {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step 1: Workspace ─────────────────────────────────────────────────────────
function WorkspaceStep({ onNext }: {
  onNext: (name: string, slug: string) => void;
}) {
  const [name, setName]         = React.useState('');
  const [slug, setSlug]         = React.useState('');
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [error, setError]       = React.useState('');
  const [loading, setLoading]   = React.useState(false);
  const token = getAccessToken() ?? '';

  const slugify = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!slugEdited) setSlug(slugify(val));
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugEdited(true);
    setSlug(slugify(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Workspace name is required');
    if (slug.length < 3) return setError('Slug must be at least 3 characters');
    setError('');
    setLoading(true);
    try {
      await workspaceApi.create(token, { name: name.trim(), slug });
      onNext(name.trim(), slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-ink">Name your workspace</h2>
        <p className="text-sm text-ink-3">A workspace holds your instances, API keys, and team members.</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink">Workspace name</label>
          <Input placeholder="Acme Corp" value={name} onChange={handleNameChange} autoFocus />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink">URL slug</label>
          <div className="flex items-center rounded-md border border-border bg-bg overflow-hidden">
            <span className="px-3 py-2 text-sm text-ink-3 bg-bg-2 border-r border-border select-none">
              clawdb.dev/
            </span>
            <input
              className="flex-1 px-3 py-2 bg-transparent text-sm text-ink font-mono outline-none"
              placeholder="acme-corp"
              value={slug}
              onChange={handleSlugChange}
            />
          </div>
          <p className="text-xs text-ink-3">Only lowercase letters, numbers, and hyphens.</p>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm text-danger">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={loading} isLoading={loading}>
        Continue <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </form>
  );
}

// ── Step 2: Instance Config ───────────────────────────────────────────────────
function InstanceStep({ onNext, onBack }: {
  onNext: (region: string, tier: string) => void;
  onBack: () => void;
}) {
  const [region, setRegion] = React.useState('US_EAST');
  const [tier, setTier]     = React.useState('NANO');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext(region, tier); }} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-ink">Configure your instance</h2>
        <p className="text-sm text-ink-3">Pick a region close to your users and a tier that fits your workload.</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink">Region</label>
          <Select value={region} onChange={(e) => setRegion(e.target.value)}>
            {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink">Instance tier</label>
          <div className="grid grid-cols-2 gap-2">
            {TIERS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTier(t.value)}
                className={cn(
                  'flex flex-col items-start p-3 rounded-md border text-left transition-all',
                  tier === t.value
                    ? 'border-accent bg-accent/10 ring-2 ring-accent/20'
                    : 'border-border bg-bg-2 hover:bg-bg-3',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Server className="w-4 h-4 text-accent" />
                  <span className="text-sm font-semibold text-ink">{t.label}</span>
                  {t.free && (
                    <span className="text-xs text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">Free</span>
                  )}
                </div>
                <span className="text-xs text-ink-3 font-mono">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onBack} className="flex-1">Back</Button>
        <Button type="submit" className="flex-1">
          Launch instance <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </form>
  );
}

// ── Step 3: Provisioning ──────────────────────────────────────────────────────
function ProvisioningStep({
  workspaceName, workspaceSlug, region, tier, onDone, onError,
}: {
  workspaceName: string;
  workspaceSlug: string;
  region: string;
  tier: string;
  onDone: (apiKey: string) => void;
  onError: (msg: string) => void;
}) {
  const [messageIdx, setMessageIdx] = React.useState(0);
  const [complete, setComplete]     = React.useState(false);
  const { refreshWorkspaces }       = useWorkspace();
  const token = getAccessToken() ?? '';
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;

    const ticker = setInterval(() => {
      setMessageIdx((prev) => Math.min(prev + 1, PROVISION_MESSAGES.length - 1));
    }, 1200);

    (async () => {
      try {
        const workspaces = await workspaceApi.list(token);
        const ws = workspaces.find((w) => w.slug === workspaceSlug) ?? workspaces[workspaces.length - 1];

        const [instance, keyResult] = await Promise.all([
          instanceApi.create(token, ws.id, {
            name: `${workspaceSlug}-main`,
            region,
            tier,
            version: 'latest',
          }),
          apiKeyApi.create(token, ws.id, {
            name: 'Default',
            scopes: ['read:memory', 'write:memory', 'manage:sync'],
          }),
        ]);

        await refreshWorkspaces();
        clearInterval(ticker);
        setMessageIdx(PROVISION_MESSAGES.length - 1);
        setTimeout(() => {
          setComplete(true);
          setTimeout(() => onDone(keyResult.rawKey), 600);
        }, 800);
      } catch (err) {
        clearInterval(ticker);
        onError(err instanceof Error ? err.message : 'Provisioning failed');
      }
    })();

    return () => clearInterval(ticker);
  }, []);

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-ink">Provisioning your instance</h2>
        <p className="text-sm text-ink-3">This usually takes about 30 seconds.</p>
      </div>
      <div className="flex flex-col items-center gap-4 py-6">
        {complete ? (
          <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
        ) : (
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-bg-3" />
            <div className="absolute inset-0 rounded-full border-4 border-t-accent animate-spin" />
          </div>
        )}
        <div className="h-8 flex items-center">
          {complete ? (
            <span className="text-sm font-medium text-green-400">Instance ready!</span>
          ) : (
            <span key={messageIdx} className="text-sm text-ink-2 animate-fade-up">
              {PROVISION_MESSAGES[messageIdx]}
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          {PROVISION_MESSAGES.map((_, i) => (
            <div
              key={i}
              className={cn('w-1.5 h-1.5 rounded-full transition-colors duration-300',
                i <= messageIdx ? 'bg-accent' : 'bg-bg-3')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Done ──────────────────────────────────────────────────────────────
function DoneStep({ apiKey, workspaceName, onFinish }: {
  apiKey: string; workspaceName: string; onFinish: () => void;
}) {
  const sdkSnippet = `import { ClawDB } from '@clawdb/sdk';

const client = new ClawDB({ apiKey: '${apiKey}' });

// Store a memory
await client.memory.set('user:42', {
  preferences: { theme: 'dark' },
  lastSeen: new Date(),
});

// Retrieve it
const memory = await client.memory.get('user:42');
console.log(memory);`;

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h2 className="text-xl font-semibold text-ink">You&apos;re all set, {workspaceName}!</h2>
        <p className="text-sm text-ink-3">Your ClawDB instance is live and ready to store AI agent memory.</p>
      </div>

      <div className="p-4 rounded-md bg-bg-2 border border-border space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <Key className="w-4 h-4 text-accent" />
          Your API key (shown once)
        </div>
        <CodeSnippet code={apiKey} language="bash" />
        <p className="text-xs text-ink-3">Store this somewhere safe — you won&apos;t be able to see it again.</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <Wifi className="w-4 h-4 text-accent" />
          Quick start
        </div>
        <CodeSnippet
          code="npm install @clawdb/sdk"
          language="bash"
          tabs={[
            { label: 'npm',  code: 'npm install @clawdb/sdk',  language: 'bash' },
            { label: 'pnpm', code: 'pnpm add @clawdb/sdk',     language: 'bash' },
            { label: 'yarn', code: 'yarn add @clawdb/sdk',     language: 'bash' },
          ]}
        />
        <CodeSnippet code={sdkSnippet} language="typescript" />
      </div>

      <Button className="w-full" onClick={onFinish}>
        Go to dashboard
      </Button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]               = React.useState<Step>('workspace');
  const [workspaceName, setWorkspaceName] = React.useState('');
  const [workspaceSlug, setWorkspaceSlug] = React.useState('');
  const [region, setRegion]           = React.useState('US_EAST');
  const [tier, setTier]               = React.useState('NANO');
  const [apiKey, setApiKey]           = React.useState('');
  const [provisionError, setProvisionError] = React.useState('');

  const handleWorkspaceDone = (name: string, slug: string) => {
    setWorkspaceName(name);
    setWorkspaceSlug(slug);
    setStep('instance');
  };

  const handleInstanceDone = (r: string, t: string) => {
    setRegion(r);
    setTier(t);
    setStep('provisioning');
  };

  const handleProvisioningDone = (key: string) => {
    setApiKey(key);
    setStep('done');
  };

  const handleProvisioningError = (msg: string) => {
    setProvisionError(msg);
    setStep('instance');
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      <div className="mb-8 flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-lg">
          🦀
        </div>
        <span className="font-semibold text-lg text-ink">ClawDB</span>
      </div>

      <div className="w-full max-w-lg">
        <Card>
          <CardBody className="p-8 space-y-8">
            <div className="flex justify-center">
              <StepIndicator current={step} />
            </div>

            {provisionError && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-danger/10 border border-danger/20 text-sm text-danger">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {provisionError}. Please try again.
              </div>
            )}

            {step === 'workspace' && (
              <WorkspaceStep onNext={handleWorkspaceDone} />
            )}
            {step === 'instance' && (
              <InstanceStep
                onNext={handleInstanceDone}
                onBack={() => setStep('workspace')}
              />
            )}
            {step === 'provisioning' && (
              <ProvisioningStep
                workspaceName={workspaceName}
                workspaceSlug={workspaceSlug}
                region={region}
                tier={tier}
                onDone={handleProvisioningDone}
                onError={handleProvisioningError}
              />
            )}
            {step === 'done' && (
              <DoneStep
                apiKey={apiKey}
                workspaceName={workspaceName}
                onFinish={() => router.push('/dashboard')}
              />
            )}
          </CardBody>
        </Card>

        <p className="text-center text-xs text-ink-3 mt-4">
          Questions?{' '}
          <a href="mailto:support@clawdb.dev" className="text-accent hover:underline">
            support@clawdb.dev
          </a>
        </p>
      </div>
    </div>
  );
}

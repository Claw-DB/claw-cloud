'use client';

import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Send, Bot, User, Trash2, Loader2, Sparkles } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Topbar } from '@/components/layout/topbar';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Types ──────────────────────────────────────────────────────────────────────
type Role = 'user' | 'assistant';

interface Message {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
}

const STARTER_PROMPTS = [
  'How do I connect to my Claw Cloud instance with Node.js?',
  'What are the best cache eviction strategies for session data?',
  'How do I set up multi-region replication?',
  'Explain the difference between RDB snapshots and AOF persistence.',
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

// ── Message Bubble ─────────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-accent" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[72%] rounded-xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-accent text-white rounded-br-sm'
            : 'bg-bg-2 border border-border text-ink rounded-bl-sm',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const isBlock = className?.includes('language-');
                  return isBlock ? (
                    <pre className="bg-bg-3 rounded-md p-3 overflow-x-auto my-2 border border-border text-xs font-mono">
                      <code {...props} className={className}>
                        {children}
                      </code>
                    </pre>
                  ) : (
                    <code
                      {...props}
                      className="bg-bg-3 px-1.5 py-0.5 rounded text-xs font-mono text-accent"
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.streaming && (
              <span className="inline-block w-1.5 h-4 bg-accent/60 rounded animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-bg-3 border border-border flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-ink-3" />
        </div>
      )}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────
function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 py-12">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-xl font-semibold text-ink">Claw AI Assistant</h2>
        <p className="text-sm text-ink-3 max-w-sm">
          Ask anything about your instances, caching strategies, or platform features.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
        {STARTER_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPrompt(p)}
            className="text-left px-4 py-3 rounded-lg border border-border bg-bg-2 hover:bg-bg-3 hover:border-accent/40 transition-all text-sm text-ink-2 hover:text-ink"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AiPage() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [sessionId] = React.useState(() => uuidv4());
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const userMsg: Message = { id: uuidv4(), role: 'user', content: trimmed };
      const assistantId = uuidv4();
      const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', streaming: true };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setIsStreaming(true);

      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('claw_access_token') : null;
        const res = await fetch(`${API_BASE}/chatbot/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: trimmed, sessionId }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6);
            try {
              const event = JSON.parse(raw) as { type: string; text?: string; message?: string };
              if (event.type === 'delta' && event.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.text }
                      : m,
                  ),
                );
              } else if (event.type === 'done') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, streaming: false } : m,
                  ),
                );
              } else if (event.type === 'error') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: event.message ?? 'An error occurred.', streaming: false }
                      : m,
                  ),
                );
              }
            } catch {
              // ignore parse errors for partial lines
            }
          }
        }
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Failed to connect to the AI service. Please try again.', streaming: false }
              : m,
          ),
        );
      } finally {
        setIsStreaming(false);
        inputRef.current?.focus();
      }
    },
    [isStreaming, sessionId],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <DashboardLayout>
      <Topbar
        title="AI Assistant"
        actions={
          messages.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearChat}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              Clear chat
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col h-[calc(100vh-57px)]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto w-full">
            {messages.length === 0 ? (
              <EmptyState onPrompt={(p) => sendMessage(p)} />
            ) : (
              <div className="space-y-6">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border bg-bg-1 px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3 items-end bg-bg-2 border border-border rounded-xl p-3 focus-within:border-accent/50 transition-colors">
              <textarea
                ref={inputRef}
                rows={1}
                placeholder="Ask anything about Claw Cloud…"
                className="flex-1 bg-transparent resize-none text-sm text-ink placeholder:text-ink-3 outline-none max-h-40 leading-relaxed"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = `${t.scrollHeight}px`;
                }}
                disabled={isStreaming}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0',
                  input.trim() && !isStreaming
                    ? 'bg-accent text-white hover:bg-accent/80'
                    : 'bg-bg-3 text-ink-3 cursor-not-allowed',
                )}
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-ink-3 text-center mt-2">
              Press Enter to send · Shift+Enter for new line · AI can make mistakes
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

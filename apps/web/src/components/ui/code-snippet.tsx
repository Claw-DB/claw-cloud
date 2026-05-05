import * as React from 'react';
import { CopyButton } from './copy-button';
import { cn } from '@/lib/utils';

export interface CodeSnippetProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string;
  language?: 'typescript' | 'python' | 'bash' | 'json' | 'jsx';
  tabs?: Array<{ label: string; code: string; language?: string }>;
}

const CodeSnippet = React.forwardRef<HTMLDivElement, CodeSnippetProps>(
  ({ code, language = 'bash', tabs, className, ...props }, ref) => {
    const [activeTab, setActiveTab] = React.useState(0);

    const currentCode = tabs ? tabs[activeTab].code : code;
    const currentLang = tabs ? tabs[activeTab].language || tabs[activeTab].label.toLowerCase() : language;

    return (
      <div
        ref={ref}
        className={cn('bg-bg border border-border rounded-md overflow-hidden', className)}
        {...props}
      >
        {tabs && (
          <div className="flex border-b border-border bg-bg-2">
            {tabs.map((tab, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === idx
                    ? 'text-accent border-b-2 border-accent'
                    : 'text-ink-3 hover:text-ink'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <pre className="p-4 overflow-x-auto text-xs font-mono text-ink">
            <code>{currentCode}</code>
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton value={currentCode} />
          </div>
        </div>
      </div>
    );
  }
);
CodeSnippet.displayName = 'CodeSnippet';

export { CodeSnippet };

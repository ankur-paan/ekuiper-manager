'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Bot, Loader2, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { isSecretField, redactAssistantValue } from '@/lib/assistant/redaction';
import { cn } from '@/lib/utils';
import { useServerStore } from '@/stores/server-store';

interface AssistantProps {
  pageTitle: string;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

interface AssistantStatus {
  enabled: boolean;
  model?: string;
}

const QUICK_PROMPTS = [
  'Explain this page',
  'What should I configure next?',
  'Review the visible values',
];

function isVisible(element: HTMLElement): boolean {
  if (element.closest('[data-assistant-root]')) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

function controlLabel(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  const explicit = Array.from(document.querySelectorAll<HTMLLabelElement>('label')).find(
    (label) => control.id && label.htmlFor === control.id,
  )?.innerText;
  const wrapped = control.closest('label')?.innerText;
  return (
    explicit ||
    wrapped ||
    control.getAttribute('aria-label') ||
    control.getAttribute('placeholder') ||
    control.name ||
    control.id ||
    control.tagName.toLowerCase()
  ).trim().slice(0, 160);
}

function controlValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  if (control instanceof HTMLInputElement) {
    if (control.type === 'password' || isSecretField(`${control.name} ${control.id} ${controlLabel(control)}`)) {
      return '[redacted]';
    }
    if (['checkbox', 'radio'].includes(control.type)) return control.checked ? 'selected' : 'not selected';
    if (['button', 'submit', 'reset', 'file', 'hidden'].includes(control.type)) return '';
  }
  if (control instanceof HTMLSelectElement) {
    return Array.from(control.selectedOptions).map((option) => option.text).join(', ');
  }
  return redactAssistantValue(control.value).slice(0, 2_000);
}

function collectScreenSnapshot(): string {
  const main = document.querySelector<HTMLElement>('main');
  if (!main) return 'No visible page content was available.';

  const text = Array.from(
    main.querySelectorAll<HTMLElement>('h1, h2, h3, h4, p, label, th, [role="status"], [role="alert"]'),
  )
    .filter(isVisible)
    .map((element) => element.innerText.trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join('\n');

  const controls = Array.from(
    main.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input, select, textarea',
    ),
  )
    .filter((control) => isVisible(control))
    .map((control) => {
      const value = controlValue(control);
      return value ? `${controlLabel(control)}: ${value}` : '';
    })
    .filter(Boolean)
    .join('\n');

  return redactAssistantValue(`${text}\n\nVisible controls:\n${controls}`.trim()).slice(0, 8_000) ||
    'No visible page content was available.';
}

async function responseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  return payload?.error?.message ?? `Request failed (${response.status})`;
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-2 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: ({ children }) => <h2 className="mt-3 text-base font-semibold first:mt-0">{children}</h2>,
          h2: ({ children }) => <h3 className="mt-3 text-sm font-semibold first:mt-0">{children}</h3>,
          h3: ({ children }) => <h4 className="mt-2 text-sm font-medium first:mt-0">{children}</h4>,
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/50 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer nofollow"
              className="font-medium text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md border bg-background/80 p-3 text-xs">
              {children}
            </pre>
          ),
          code: ({ className, children }) =>
            className ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded bg-background/80 px-1 py-0.5 text-[0.9em]">{children}</code>
            ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border px-2 py-1.5 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border px-2 py-1.5 align-top">{children}</td>,
          img: ({ alt }) => <span className="text-muted-foreground">[Image omitted: {alt ?? 'unlabelled'}]</span>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function Assistant({ pageTitle }: AssistantProps) {
  const pathname = usePathname();
  const activeServer = useServerStore((state) => state.getActiveServer());
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<AssistantStatus | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const nextId = React.useRef(1);
  const scrollEnd = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/assistant/status', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        setStatus((await response.json()) as AssistantStatus);
      })
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
          setStatus({ enabled: false });
        }
      });
    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    scrollEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const send = React.useCallback(
    async (prompt: string) => {
      const content = redactAssistantValue(prompt).slice(0, 4_000);
      if (!content || sending || !status?.enabled) return;

      const userMessage: ChatMessage = { id: nextId.current++, role: 'user', content };
      const conversation = [...messages, userMessage].slice(-12);
      setMessages(conversation);
      setDraft('');
      setError(null);
      setSending(true);
      try {
        const response = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversation.map(({ role, content: messageContent }) => ({
              role,
              content: messageContent,
            })),
            context: {
              path: pathname,
              title: pageTitle,
              snapshot: collectScreenSnapshot(),
              ...(activeServer
                ? {
                    activeNode: {
                      name: activeServer.name,
                      ...(activeServer.version ? { version: activeServer.version } : {}),
                    },
                  }
                : {}),
            },
          }),
        });
        if (!response.ok) throw new Error(await responseError(response));
        const payload = (await response.json()) as { message: string; suggestions?: string[] };
        setMessages((current) => [
          ...current,
          {
            id: nextId.current++,
            role: 'assistant',
            content: payload.message,
            suggestions: payload.suggestions?.slice(0, 3),
          },
        ]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The assistant could not respond');
      } finally {
        setSending(false);
      }
    },
    [activeServer, messages, pageTitle, pathname, sending, status?.enabled],
  );

  return (
    <div data-assistant-root>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            className="fixed bottom-5 right-5 z-40 h-12 rounded-full px-4 shadow-lg"
            aria-label="Open AI assistant"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Ask AI
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="flex w-[min(100vw,30rem)] flex-col gap-0 p-0 sm:max-w-lg"
          data-assistant-root
        >
          <SheetHeader className="border-b p-5 pr-12 text-left">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <SheetTitle>Operator assistant</SheetTitle>
            </div>
            <SheetDescription>
              Context-aware help for {pageTitle}. It advises; you review and operate every control.
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center justify-between border-b px-5 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Visible secrets are redacted
            </span>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setMessages([]);
                  setError(null);
                }}
                disabled={sending}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 p-5" aria-live="polite">
              {!status && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking assistant configuration…
                </div>
              )}

              {status && !status.enabled && (
                <div className="rounded-lg border border-dashed p-4 text-sm">
                  <p className="font-medium">Assistant provider not configured</p>
                  <p className="mt-2 text-muted-foreground">
                    The Manager owner can enable it with <code>AI_ASSISTANT_ENABLED</code>,{' '}
                    <code>AI_API_URL</code>, <code>AI_MODEL</code>, and optionally{' '}
                    <code>AI_API_KEY</code>, then restart the Manager container.
                  </p>
                </div>
              )}

              {status?.enabled && messages.length === 0 && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted/60 p-4 text-sm">
                    <p className="font-medium">Ask about any visible option</p>
                    <p className="mt-1 text-muted-foreground">
                      I receive a redacted snapshot of this page only when you send a message. I cannot
                      click, save, start, stop, or delete resources.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <Button
                        key={prompt}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto whitespace-normal text-left"
                        onClick={() => void send(prompt)}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={message.id} className={cn('max-w-[92%]', message.role === 'user' && 'ml-auto')}>
                  <div
                    data-message-role={message.role}
                    className={cn(
                      'overflow-x-auto rounded-lg px-3 py-2 text-sm',
                      message.role === 'user'
                        ? 'whitespace-pre-wrap bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground',
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <AssistantMarkdown content={message.content} />
                    ) : (
                      message.content
                    )}
                  </div>
                  {message.role === 'assistant' &&
                    index === messages.length - 1 &&
                    message.suggestions &&
                    message.suggestions.length > 0 && (
                      <div className="mt-2 space-y-2" aria-label="Suggested next questions">
                        <p className="text-xs font-medium text-muted-foreground">Continue with</p>
                        <div className="flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion) => (
                            <Button
                              key={suggestion}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-auto whitespace-normal text-left text-xs"
                              onClick={() => void send(suggestion)}
                              disabled={sending}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              )}
              {error && (
                <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div ref={scrollEnd} />
            </div>
          </ScrollArea>

          <form
            className="border-t p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <label htmlFor="assistant-message" className="sr-only">
              Ask the operator assistant
            </label>
            <div className="flex items-end gap-2">
              <Textarea
                id="assistant-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={status?.enabled ? 'Ask about this page…' : 'Assistant is not configured'}
                maxLength={4_000}
                rows={3}
                disabled={!status?.enabled || sending}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!status?.enabled || sending || !draft.trim()}
                aria-label="Send message"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              AI can be wrong. Review generated SQL, JSON, and operational advice before acting.
            </p>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

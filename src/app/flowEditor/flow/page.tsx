'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Code, ExternalLink, RefreshCw, Sparkles, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useServerStore } from '@/stores/server-store';

function FlowEditorContent() {
  const searchParams = useSearchParams();
  const ruleId = searchParams.get('id') ?? '';
  const ruleName = searchParams.get('name') ?? ruleId;
  const oper = searchParams.get('oper') ?? 'create';

  const { servers, activeServerId } = useServerStore();
  const activeNode = servers.find((node) => node.id === activeServerId);
  const [iframeKey, setIframeKey] = React.useState(0);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // Configure localStorage in parent and post init setup to iframe if needed
  React.useEffect(() => {
    try {
      localStorage.setItem('baseURL', '/api/ekuiper');
      localStorage.setItem('language', 'en');
    } catch {
      // localStorage may fail in restricted sandboxes
    }
  }, []);

  const handleIframeLoad = () => {
    setIsLoaded(true);
    try {
      if (iframeRef.current?.contentWindow) {
        const win = iframeRef.current.contentWindow;
        win.localStorage.setItem('baseURL', '/api/ekuiper');
        win.localStorage.setItem('language', 'en');
      }
    } catch {
      // Cross-origin fallback (same-origin will succeed)
    }
  };

  const iframeSrc = React.useMemo(() => {
    const params = new URLSearchParams();
    if (ruleName) params.set('name', ruleName);
    if (ruleId) params.set('id', ruleId);
    if (oper) params.set('oper', oper);
    const qs = params.toString();
    return `/web/common/flow/index.html${qs ? `?${qs}` : ''}`;
  }, [ruleName, ruleId, oper]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Control Plane Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/80 bg-card px-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground transition-transform duration-150 active:scale-[0.97] hover:text-foreground"
          >
            <Link href="/rules">
              <ArrowLeft className="h-3.5 w-3.5" />
              Rules catalog
            </Link>
          </Button>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold tracking-tight text-foreground">
              {ruleName ? (
                <>
                  Flow Editor <span className="font-mono text-muted-foreground">({ruleName})</span>
                </>
              ) : (
                'Visual Rule Flow Canvas'
              )}
            </span>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium text-muted-foreground">
              Beta
            </Badge>
          </div>

          {activeNode && (
            <Badge variant="secondary" className="hidden font-mono text-[11px] sm:inline-flex">
              {activeNode.name}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {ruleId && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs transition-transform duration-150 active:scale-[0.97]"
            >
              <Link href={`/rules/${ruleId}`}>
                <Code className="h-3.5 w-3.5" />
                SQL editor
              </Link>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsLoaded(false);
              setIframeKey((k) => k + 1);
            }}
            className="h-8 gap-1.5 text-xs transition-transform duration-150 active:scale-[0.97]"
            title="Reload flow canvas"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </Button>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <a
              href="https://github.com/lf-edge/ekuiper/blob/master/docs/en/rules/overview.md"
              target="_blank"
              rel="noreferrer"
              title="eKuiper Rule Documentation"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </header>

      {/* Main Flow Canvas Viewport */}
      <div className="relative flex-1 bg-muted/10">
        {!isLoaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
            <div className="flex h-10 w-10 animate-spin items-center justify-center rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground">Initializing stream processing canvas…</p>
          </div>
        )}

        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={iframeSrc}
          onLoad={handleIframeLoad}
          title="eKuiper Flow Visual Editor"
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </div>
    </div>
  );
}

export default function FlowEditorPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-background text-xs text-muted-foreground">
          Loading Flow Editor…
        </div>
      }
    >
      <FlowEditorContent />
    </React.Suspense>
  );
}

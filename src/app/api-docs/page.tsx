'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, ExternalLink, RefreshCw, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ApiDocsPage() {
  const [iframeKey, setIframeKey] = React.useState(0);
  const [isLoaded, setIsLoaded] = React.useState(false);

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
            <Link href="/help">
              <ArrowLeft className="h-3.5 w-3.5" />
              Documentation
            </Link>
          </Button>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold tracking-tight text-foreground">
              eKuiper & Gateway REST API Reference
            </span>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono font-medium text-muted-foreground">
              OpenAPI 3.0
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsLoaded(false);
              setIframeKey((k) => k + 1);
            }}
            className="h-8 gap-1.5 text-xs transition-transform duration-150 active:scale-[0.97]"
            title="Reload API Docs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs transition-transform duration-150 active:scale-[0.97]"
          >
            <a href="/api-docs/index.html" target="_blank" rel="noopener noreferrer">
              Open Fullscreen
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </header>

      {/* Main Viewport */}
      <div className="relative flex-1 bg-white">
        {!isLoaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
            <div className="flex h-10 w-10 animate-spin items-center justify-center rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground">Rendering OpenAPI interactive reference…</p>
          </div>
        )}

        <iframe
          key={iframeKey}
          src="/api-docs/index.html"
          onLoad={() => setIsLoaded(true)}
          title="Interactive API Documentation"
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}

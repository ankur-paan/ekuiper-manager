'use client';

import * as React from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FlowStudioPage } from '@/components/flow-studio/flow-studio-page';
import { generateLargeFlow } from '@/lib/flows/testing/generate-large-flow';

const PERF_FIXTURE_SIZES = [50, 250, 500, 1000] as const;

type PerfFixtureSize = (typeof PERF_FIXTURE_SIZES)[number];

const DEFAULT_PERF_FIXTURE_SIZE: PerfFixtureSize = 500;

function isPerfFixtureSize(value: number): value is PerfFixtureSize {
  return (PERF_FIXTURE_SIZES as readonly number[]).includes(value);
}

/**
 * FS-0122 development-only Flow Studio performance fixture route.
 *
 * Renders a deterministic generated fixture (FS-0121) inside the real Flow
 * Studio page purely from browser memory: the fixture document is passed via
 * `initialDocument`, server flow/draft loading and draft autosave stay
 * disabled, and this route issues no flow/draft API writes (it performs no
 * `fetch` at all). Switching sizes only swaps the in-memory document.
 *
 * The route is unavailable in production builds (existing `NODE_ENV`
 * convention) and is clearly labeled development-only otherwise.
 */
export default function FlowStudioPerfPage() {
  const [size, setSize] = React.useState<PerfFixtureSize>(DEFAULT_PERF_FIXTURE_SIZE);
  const fixture = React.useMemo(
    () => (process.env.NODE_ENV === 'production' ? null : generateLargeFlow(size)),
    [size],
  );

  if (fixture === null) {
    return (
      <AppLayout title="Not available">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="flex flex-col items-center py-14 text-center">
              <h2 className="font-semibold">Not available in production</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The Flow Studio performance fixture route is development-only and
                is disabled in this build.
              </p>
              <Button asChild className="mt-5">
                <Link href="/flows">Back to flows</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const nodeCount = fixture.spec.nodes.length;
  const edgeCount = fixture.spec.edges.length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Development-only toolbar. Rendered above the studio shell (which
          owns its own AppLayout) so no layout is nested. */}
      <div
        className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-background px-4 py-2"
        data-testid="flow-perf-toolbar"
      >
        <span className="rounded border border-dashed border-muted-foreground/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Development only — performance fixture
        </span>
        <span className="text-xs text-muted-foreground">
          Local generated flow, nothing is saved to the server and Deploy stays disabled.
        </span>
        <div className="flex items-center gap-1" role="group" aria-label="Fixture size">
          {PERF_FIXTURE_SIZES.map((option) => (
            <Button
              key={option}
              type="button"
              variant={option === size ? 'default' : 'outline'}
              size="sm"
              aria-pressed={option === size}
              data-testid={`flow-perf-size-${option}`}
              onClick={() => {
                if (isPerfFixtureSize(option)) setSize(option);
              }}
            >
              {option}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground" data-testid="flow-perf-counts">
          {nodeCount} nodes · {edgeCount} edges
        </span>
        <span className="flex-1" />
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/flows">Back to flows</Link>
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <FlowStudioPage flowId={fixture.metadata.id} initialDocument={fixture} />
      </div>
    </div>
  );
}

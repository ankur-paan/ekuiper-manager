'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FlowEditorPage() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace('/flows');
  }, [router]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background text-foreground p-4">
      <Workflow className="size-10 text-primary animate-pulse" />
      <h1 className="text-base font-semibold">Redirecting to Flow Studio…</h1>
      <p className="text-xs text-muted-foreground">eKuiper Flow Studio has replaced legacy external editors.</p>
      <Button asChild variant="outline" size="sm" className="text-xs">
        <Link href="/flows">
          <ArrowLeft className="mr-1.5 size-3.5" />
          Go to Flow Studio
        </Link>
      </Button>
    </div>
  );
}

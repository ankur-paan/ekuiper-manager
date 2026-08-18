"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { UnifiedSearch } from "@/components/common/unified-search";
import { Assistant } from "@/components/assistant/assistant";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [sessionReady, setSessionReady] = React.useState(false);

  // Prevent hydration mismatch - wait for client mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace('/welcome');
          return;
        }
        if (!response.ok) {
          setSessionReady(true);
          return;
        }
        const payload = await response.json();
        if (payload?.user?.mustChangePassword) {
          router.replace('/change-password');
          return;
        }
        setSessionReady(true);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setSessionReady(true);
      });
    return () => controller.abort();
  }, [router]);

  // Show minimal skeleton during hydration to prevent layout shift
  if (!mounted || !sessionReady) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar skeleton - hidden on mobile */}
        <div className="hidden md:block w-64 border-r bg-background shrink-0" />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <div className="h-14 border-b bg-background shrink-0" />
          <main className="flex-1 overflow-auto p-4 md:p-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Hidden on mobile, visible on md+ screens */}
      <div className="hidden md:block shrink-0">
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header title={title} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      <UnifiedSearch />
      <Assistant pageTitle={title ?? 'eKuiper Manager'} />
    </div>
  );
}

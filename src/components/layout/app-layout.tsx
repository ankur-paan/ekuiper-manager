"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { UnifiedSearch } from "@/components/common/unified-search";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Prevent hydration mismatch - wait for client mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Show minimal skeleton during hydration to prevent layout shift
  if (!mounted) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="w-64 border-r bg-background" />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="h-14 border-b bg-background" />
          <main className="flex-1 overflow-auto p-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
      <UnifiedSearch />
    </div>
  );
}

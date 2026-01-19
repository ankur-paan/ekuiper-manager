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
    </div>
  );
}

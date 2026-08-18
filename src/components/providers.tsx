"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { useServerStore } from "@/stores/server-store";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Initialize Server Store
  const fetchServers = useServerStore((state) => state.fetchServers);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/welcome" && pathname !== "/change-password") {
      void fetchServers();
    }
  }, [fetchServers, pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster richColors closeButton position="bottom-left" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

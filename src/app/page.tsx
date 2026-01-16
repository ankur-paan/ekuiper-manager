"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Redirecting to Dashboard...</h1>
        <p className="text-muted-foreground">
          If you are not redirected automatically,{" "}
          <a href="/dashboard" className="text-primary hover:underline">
            click here
          </a>
          .
        </p>
      </div>
    </div>
  );
}

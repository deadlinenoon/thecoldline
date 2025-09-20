"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log error on the client for visibility; server logs will capture stack.
     
    console.error("App error boundary:", error?.message, error?.digest);
  }, [error]);
  return (
    <div style={{ padding: "1rem" }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h1>
      <p style={{ marginTop: 8 }}>An unexpected error occurred. You can try reloading this section or go back home.</p>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button onClick={() => reset()} style={{ padding: "0.4rem 0.75rem", border: "1px solid #e5e7eb", borderRadius: 6 }}>Try again</button>
        <Link href="/" className="text-blue-600 hover:underline">Go to Home</Link>
      </div>
    </div>
  );
}


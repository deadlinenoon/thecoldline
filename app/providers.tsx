"use client";
import React from "react";

// Pass-through provider since Convex was removed.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

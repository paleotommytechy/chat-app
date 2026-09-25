"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return (
      <main className="setup-screen">
        <div className="setup-card">
          <span className="brand-mark">F</span>
          <h1>Convex is not connected yet</h1>
          <p>
            Run <code>npx convex dev</code> once, then restart the app. The command creates
            <code> NEXT_PUBLIC_CONVEX_URL</code> automatically.
          </p>
        </div>
      </main>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

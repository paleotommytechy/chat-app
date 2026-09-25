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
          <span className="brand-mark">
            <img src="/syncret-logo.svg" alt="" width="42" height="42" />
          </span>
          <h1>Syncret is not connected yet</h1>
          <p>
            Set <code>NEXT_PUBLIC_CONVEX_URL</code> in your environment, then restart
            the app.
          </p>
        </div>
      </main>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

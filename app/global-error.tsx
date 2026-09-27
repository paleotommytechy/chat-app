"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Syncret global error", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background:
            "radial-gradient(circle at 50% 18%, rgba(72,105,255,.14), transparent 34%), #090b11",
          color: "#eef1f7",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <main
          style={{
            width: "min(100%, 430px)",
            padding: 28,
            border: "1px solid rgba(255,255,255,.09)",
            borderRadius: 24,
            background: "rgba(18,22,31,.94)",
            boxShadow: "0 28px 80px rgba(0,0,0,.42)",
            textAlign: "center",
          }}
        >
          <img
            src="/syncret-logo.svg"
            alt=""
            width="72"
            height="72"
            style={{ borderRadius: 20 }}
          />
          <h1 style={{ margin: "18px 0 8px", fontSize: 24 }}>
            Syncret hit a temporary problem
          </h1>
          <p
            style={{
              margin: "0 auto 22px",
              color: "#8d97aa",
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            Your data is safe. Try loading the workspace again. If the problem
            continues, refresh the browser once.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              width: "100%",
              minHeight: 46,
              border: 0,
              borderRadius: 13,
              background: "linear-gradient(110deg, #188ef7, #6353ee)",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

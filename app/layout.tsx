import type { Metadata } from "next";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Syncret",
  applicationName: "Syncret",
  description: "A private realtime workspace for developers to chat, share screenshots, files, encrypted environment files, voice notes, and push notifications.",
  appleWebApp: {
    capable: true,
    title: "Syncret",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}

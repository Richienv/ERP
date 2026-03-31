import type { Metadata } from "next";
import { Geist, Outfit } from "next/font/google";
import { GlobalLayout } from "@/components/global-layout";
import { ThemeProvider } from "next-themes";
import { WorkflowConfigProvider } from "@/components/workflow/workflow-config-context";
import { QueryProvider } from "@/lib/query-client";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistem ERP Darren Raymon",
  description: "Sistem Perencanaan Sumber Daya Perusahaan (ERP) Darren Raymon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://qundyzibdhggwhxgtlus.supabase.co" />
        <link rel="dns-prefetch" href="https://qundyzibdhggwhxgtlus.supabase.co" />
      </head>
      <body
        className={`${geistSans.variable} ${outfit.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="ritchie-minimal"
          enableSystem
          disableTransitionOnChange
          themes={["light", "dark", "claude", "autumn", "earth", "ritchie", "ritchie-minimal"]}
        >
          <QueryProvider>
            <WorkflowConfigProvider>
              <GlobalLayout>{children}</GlobalLayout>
            </WorkflowConfigProvider>
          </QueryProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}

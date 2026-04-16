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
  title: {
    default: "Integra — Satu sistem. Semua kendali.",
    template: "%s | Integra",
  },
  description:
    "Satu sistem. Semua kendali. Dibuat untuk pemilik usaha. Bukan departemen IT.",
  metadataBase: new URL("https://integra-id.vercel.app"),
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Integra",
    title: "Integra — Satu sistem. Semua kendali.",
    description:
      "Dibuat untuk pemilik usaha. Bukan departemen IT. Satu platform, kendali penuh.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Integra — Satu sistem. Semua kendali.",
    description:
      "Dibuat untuk pemilik usaha. Bukan departemen IT. Satu platform, kendali penuh.",
  },
  keywords: [
    "ERP",
    "Integra",
    "ERP Indonesia",
    "sistem ERP",
    "manajemen inventaris",
    "keuangan",
    "manufaktur",
  ],
  authors: [{ name: "Integra" }],
  creator: "Integra",
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

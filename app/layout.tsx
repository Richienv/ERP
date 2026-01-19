import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit, Playfair_Display } from "next/font/google";
import { GlobalLayout } from "@/components/global-layout";
import { ThemeProvider } from "next-themes";
import { WorkflowConfigProvider } from "@/components/workflow/workflow-config-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-serif",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} ${playfair.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="ritchie-minimal"
          enableSystem
          disableTransitionOnChange
          themes={["light", "dark", "claude", "autumn", "earth", "ritchie", "ritchie-minimal"]}
        >
          <WorkflowConfigProvider>
            <GlobalLayout>{children}</GlobalLayout>
          </WorkflowConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

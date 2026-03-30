import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker deployment
  output: "standalone",

  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has TypeScript errors.
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // React Compiler — auto-memoizes components, removes need for manual useMemo/useCallback
  reactCompiler: true,

  experimental: {
    // Client-side router cache — prevents RSC payload refetch on every navigation
    // dynamic: 30s keeps dynamic pages cached for 30s before refetch
    // static: 300s (5min) keeps static pages cached for 5min
    staleTimes: {
      dynamic: 30,
      static: 300,
    },

    // NOTE: cacheComponents (PPR) is incompatible with `export const dynamic = "force-dynamic"`
    // which is used in 93+ API routes. Enabling requires migrating all those routes first.
    // cacheComponents: true,

    // Bundle optimization — tree-shake heavy libraries
    optimizePackageImports: [
      "lucide-react",
      "@tabler/icons-react",
      "@tanstack/react-table",
      "@tanstack/react-query",
      "@tanstack/react-virtual",
      "date-fns",
      "recharts",
      "framer-motion",
      "zod",
      "sonner",
      "xlsx",
      "@radix-ui/react-icons",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@supabase/supabase-js",
    ],
  },

  // Include Typst binary and templates in Vercel serverless function bundles
  outputFileTracingIncludes: {
    "/api/documents/purchase-order/[id]": ["./bin/**/*", "./templates/**/*"],
    "/api/documents/payroll/[id]": ["./bin/**/*", "./templates/**/*"],
    "/api/documents/payslip/[period]/[employeeId]": ["./bin/**/*", "./templates/**/*"],
  },
};

export default nextConfig;

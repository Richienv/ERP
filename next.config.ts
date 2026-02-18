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

  // Bundle optimization — tree-shake heavy libraries
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@tabler/icons-react",
      "@tanstack/react-table",
      "date-fns",
      "recharts",
      "framer-motion",
      "@radix-ui/react-icons",
    ],
  },

  // Include Typst binary and templates in Vercel serverless function bundles
  outputFileTracingIncludes: {
    "/api/documents/purchase-order/[id]": ["./bin/**/*", "./templates/**/*"],
    "/api/documents/payroll/[period]": ["./bin/**/*", "./templates/**/*"],
    "/api/documents/payslip/[period]/[employeeId]": ["./bin/**/*", "./templates/**/*"],
  },
};

export default nextConfig;

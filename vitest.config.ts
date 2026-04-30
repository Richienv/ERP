
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: 'node',
        include: ['**/*.test.ts', '**/*.test.tsx'],
        globals: true,
        setupFiles: ['./test-setup.ts'],
        // Per-file environment: React component tests opt in via
        //   /** @vitest-environment jsdom */
        // at the top of the file. Logic tests stay on the fast 'node' env.
    },
})

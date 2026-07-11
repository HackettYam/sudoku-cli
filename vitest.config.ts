import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Resolve the absolute path to @hackettyam/sudoku-tools/dist.
 *
 * The published v1.0.0 of the library ships ESM and CJS output with
 * unresolved `@/...` TypeScript path aliases (the build does not run
 * tsc-alias). We work around this by mapping the alias to the library's
 * dist directory at test time via vite's resolver.
 *
 * `import.meta.resolve` returns the URL of the entry point per the
 * package's `exports` field (the ESM `dist/index.js`). We derive the
 * dist directory from it.
 */
const libEntryUrl = import.meta.resolve('@hackettyam/sudoku-tools')
const libDist = resolve(dirname(fileURLToPath(libEntryUrl)), '.')

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/(.*)$/,
        replacement: `${libDist}/$1`,
      },
    ],
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.ts',
        'src/cli.ts',
        'src/index.ts',
        'src/commands/contract.ts',
        '**/proper-lockfile.d.ts',
        'AGENTS.md',
      ],
      thresholds: {
        // G-T02: 100% line coverage for all exported functions.
        // Branch coverage is reported but not enforced; v8 has false-positive
        // branch counts for ternaries and short-circuit operators that
        // are not realistically reachable.
        lines: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
})

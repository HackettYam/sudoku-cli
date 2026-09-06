import { build } from 'esbuild'
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const libDist = join(root, 'node_modules', '@hackettyam', 'sudoku-tools', 'dist')

/**
 * Resolve an absolute path inside the library dist to a real file.
 *
 *   - if it points to a directory, return `<path>/index.js`;
 *   - if it points to a file, return as-is;
 *   - if it points to nothing, try appending `.js` (the library omits
 *     the extension on its internal imports);
 *   - otherwise return the input unchanged and let esbuild report a
 *     sensible error.
 */
function resolveLibPath(absolutePath) {
  try {
    const stat = statSync(absolutePath)
    if (stat.isDirectory()) {
      return join(absolutePath, 'index.js')
    }
    return absolutePath
  } catch {
    if (existsSync(`${absolutePath}.js`)) {
      return `${absolutePath}.js`
    }
    return absolutePath
  }
}

const bundleOptions = {
  bundle: true,
  platform: 'node',
  target: 'node18.3',
  format: 'esm',
  external: ['proper-lockfile'],
  sourcemap: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'sudoku-tools-resolver',
      setup(buildApi) {
        // Match `@/...` aliases used inside the library's dist.
        buildApi.onResolve({ filter: /^@\// }, (args) => ({
          path: resolveLibPath(resolve(libDist, args.path.slice(2))),
        }))

        // Match directory imports (e.g. `dist/models`, `dist/constants`)
        // made by the library, which esbuild's default resolver does not
        // normalize to `index.js` for absolute paths.
        buildApi.onResolve({ filter: /.*/ }, (args) => {
          if (args.path.startsWith(libDist)) {
            const resolved = resolveLibPath(args.path)
            if (resolved !== args.path) {
              return { path: resolved }
            }
          }
          return null
        })
      },
    },
  ],
}

await build({
  ...bundleOptions,
  entryPoints: [join(root, 'src', 'cli.ts')],
  outfile: join(root, 'dist', 'cli.js'),
})

await build({
  ...bundleOptions,
  entryPoints: [join(root, 'src', 'index.ts')],
  outfile: join(root, 'dist', 'index.js'),
})

const outPath = join(root, 'dist', 'cli.js')
const original = readFileSync(outPath, 'utf8')
if (!original.startsWith('#!')) {
  writeFileSync(outPath, `#!/usr/bin/env node\n${original}`)
}

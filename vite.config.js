import { lstat, readdir, readFile, realpath, unlink } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const virtualId = 'virtual:graph-files'
const resolvedVirtualId = `\0${virtualId}`

function isExcluded(name, isRoot) {
  return name.startsWith('.') || name === 'node_modules' || name === 'dist' ||
    (isRoot && (name === 'package.json' || name === 'package-lock.json'))
}

function compareEntries(a, b) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
}

function safeGraphPath(graphRoot, absolutePath) {
  const relativePath = path.relative(graphRoot, absolutePath)
  if (!relativePath || path.isAbsolute(relativePath)) return false
  const segments = relativePath.split(path.sep)
  if (segments.some((segment) => !segment || segment === '..' || isExcluded(segment, false))) return false
  if (segments.length === 1 && ['package.json', 'package-lock.json'].includes(segments[0])) return false
  return /\.json$/i.test(segments.at(-1))
}

function resolveRequestedPath(graphRoot, requestedPath) {
  if (typeof requestedPath !== 'string' || !requestedPath.startsWith('/') || requestedPath.startsWith('//') || requestedPath.includes('\\') || requestedPath.includes('\0')) {
    return null
  }
  const segments = requestedPath.slice(1).split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || isExcluded(segment, false))) {
    return null
  }
  const absolutePath = path.resolve(graphRoot, ...segments)
  return safeGraphPath(graphRoot, absolutePath) ? absolutePath : null
}

function isInsideRoot(root, target) {
  const relativePath = path.relative(root, target)
  return relativePath && !relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath)
}

async function discover(graphRoot, directory = graphRoot, relativeDirectory = '') {
  const files = []
  const entries = (await readdir(directory, { withFileTypes: true })).sort(compareEntries)

  for (const entry of entries) {
    if (isExcluded(entry.name, !relativeDirectory)) continue
    const absolutePath = path.join(directory, entry.name)
    const relativePath = path.posix.join(relativeDirectory, entry.name)

    if (entry.isDirectory()) {
      files.push(...await discover(graphRoot, absolutePath, relativePath))
    } else if (entry.isFile() && /\.json$/i.test(entry.name)) {
      files.push({ absolutePath, relativePath: `/${relativePath}` })
    }
  }

  return files
}

function graphFilesPlugin(graphRoot, reviewGraph, reviewMode, reviewFilters, analyzeReviewMode) {
  return {
    name: 'callscape-graph-files',
    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId
    },
    async load(id) {
      if (id !== resolvedVirtualId) return
      const sources = {}
      if (reviewGraph) {
        sources['/review.json'] = JSON.stringify(reviewGraph)
      } else {
        for (const file of await discover(graphRoot)) {
          this.addWatchFile(file.absolutePath)
          sources[file.relativePath] = await readFile(file.absolutePath, 'utf8')
        }
      }
      return [
        `export const graphFileSources = ${JSON.stringify(sources)};`,
        `export const graphRootName = ${JSON.stringify(path.basename(graphRoot))};`,
        `export const graphRootPath = ${JSON.stringify(graphRoot)};`,
        `export const graphReadOnly = ${Boolean(reviewGraph)};`,
        `export const initialReviewMode = ${JSON.stringify(reviewMode || null)};`,
        `export const initialReviewFilters = ${JSON.stringify(reviewFilters || { include: '', exclude: '' })};`,
      ].join('\n')
    },
    configureServer(server) {
      if (reviewGraph) {
        server.middlewares.use('/__callscape/review', async (request, response) => {
          if (request.method !== 'POST') {
            response.writeHead(405, { Allow: 'POST' }).end()
            return
          }
          try {
            let body = ''
            for await (const chunk of request) {
              body += chunk
              if (body.length > 4096) {
                response.writeHead(413).end('Review request is too large')
                return
              }
            }
            const payload = JSON.parse(body)
            const { mode, include = '', exclude = '' } = payload
            if (!['uncommitted', 'last-commit', 'against-main'].includes(mode) && !(mode === 'custom' && reviewMode === 'custom')) {
              response.writeHead(400).end('Unknown review comparison')
              return
            }
            if (typeof include !== 'string' || typeof exclude !== 'string' || include.length > 1024 || exclude.length > 1024) {
              response.writeHead(400).end('Invalid review file filters')
              return
            }
            const graph = await analyzeReviewMode(mode, { include, exclude })
            response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
              .end(JSON.stringify(graph))
          } catch (error) {
            response.writeHead(422).end(error.message)
          }
        })
        return
      }
      server.watcher.add(graphRoot)
      const refresh = (file) => {
        if (!safeGraphPath(graphRoot, path.resolve(file))) return
        const module = server.moduleGraph.getModuleById(resolvedVirtualId)
        if (module) server.moduleGraph.invalidateModule(module)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', refresh)
      server.watcher.on('change', refresh)
      server.watcher.on('unlink', refresh)

      server.middlewares.use('/__callscape/graph-file', async (request, response) => {
        if (request.method !== 'DELETE') {
          response.writeHead(405, { Allow: 'DELETE' }).end()
          return
        }

        const url = new URL(request.url, 'http://localhost')
        const target = resolveRequestedPath(graphRoot, url.searchParams.get('path'))
        if (!target) {
          response.writeHead(400).end('Invalid graph path')
          return
        }

        try {
          const metadata = await lstat(target)
          if (!metadata.isFile()) {
            response.writeHead(400).end('Not a regular graph file')
            return
          }
          const [realRoot, realTarget] = await Promise.all([realpath(graphRoot), realpath(target)])
          if (!isInsideRoot(realRoot, realTarget)) {
            response.writeHead(400).end('Graph path escapes the root')
            return
          }
          await unlink(target)
          response.writeHead(204).end()
        } catch (error) {
          if (error.code === 'ENOENT') {
            response.writeHead(404).end('Graph file not found')
          } else {
            response.writeHead(500).end('Could not delete graph file')
          }
        }
      })
    },
  }
}

export function createCallscapeConfig({
  graphRoot = process.env.CALLSCAPE_GRAPH_ROOT || process.cwd(),
  reviewGraph = null,
  reviewMode = null,
  reviewFilters = null,
  analyzeReviewMode = null,
} = {}) {
  const resolvedRoot = path.resolve(graphRoot)
  return { plugins: [react(), graphFilesPlugin(resolvedRoot, reviewGraph, reviewMode, reviewFilters, analyzeReviewMode)] }
}

export default defineConfig(createCallscapeConfig())

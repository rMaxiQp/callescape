import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const virtualId = 'virtual:graph-files'
const resolvedVirtualId = `\0${virtualId}`
const graphRoot = path.resolve(process.env.CALLSCAPE_GRAPH_ROOT || process.cwd())

function isExcluded(name, isRoot) {
  return name.startsWith('.') || name === 'node_modules' || name === 'dist' ||
    (isRoot && (name === 'package.json' || name === 'package-lock.json'))
}

function compareEntries(a, b) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
}

async function discover(directory = graphRoot, relativeDirectory = '') {
  const files = []
  const entries = (await readdir(directory, { withFileTypes: true })).sort(compareEntries)

  for (const entry of entries) {
    if (isExcluded(entry.name, !relativeDirectory)) continue
    const absolutePath = path.join(directory, entry.name)
    const relativePath = path.posix.join(relativeDirectory, entry.name)

    if (entry.isDirectory()) {
      files.push(...await discover(absolutePath, relativePath))
    } else if (entry.isFile() && /\.json$/i.test(entry.name)) {
      files.push({ absolutePath, relativePath: `/${relativePath}` })
    }
  }

  return files
}

function graphFilesPlugin() {
  return {
    name: 'callscape-graph-files',
    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId
    },
    async load(id) {
      if (id !== resolvedVirtualId) return
      const sources = {}
      for (const file of await discover()) {
        this.addWatchFile(file.absolutePath)
        sources[file.relativePath] = await readFile(file.absolutePath, 'utf8')
      }
      return [
        `export const graphFileSources = ${JSON.stringify(sources)};`,
        `export const graphRootName = ${JSON.stringify(path.basename(graphRoot))};`,
        `export const graphRootPath = ${JSON.stringify(graphRoot)};`,
      ].join('\n')
    },
  }
}

export default defineConfig({ plugins: [react(), graphFilesPlugin()] })

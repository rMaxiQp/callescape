#!/usr/bin/env node

import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const usage = `Usage: callscape [folder]

Start Callscape for graph JSON files in the current directory or a supplied folder.`

async function main() {
  const arguments_ = process.argv.slice(2)

  if (arguments_.length === 1 && ['--help', '-h'].includes(arguments_[0])) {
    console.log(usage)
    return
  }

  if (arguments_.length > 1 || arguments_[0]?.startsWith('-')) {
    throw new Error('Expected at most one folder argument.')
  }

  const graphRoot = path.resolve(process.cwd(), arguments_[0] || '.')
  let directory
  try {
    directory = await stat(graphRoot)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Folder does not exist: ${graphRoot}`)
    }
    throw error
  }

  if (!directory.isDirectory()) {
    throw new Error(`Not a directory: ${graphRoot}`)
  }

  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  process.env.CALLSCAPE_GRAPH_ROOT = graphRoot

  // Import after setting the graph root so Vite's config sees the selected folder.
  const { createServer } = await import('vite')
  const server = await createServer({ root: appRoot, server: { open: true } })
  await server.listen()

  console.log(`Graph folder: ${graphRoot}`)
  server.printUrls()

  let closing = false
  const close = async () => {
    if (closing) return
    closing = true
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', close)
  process.on('SIGTERM', close)
}

main().catch((error) => {
  console.error(`Callscape startup error: ${error.message}`)
  console.error(usage)
  process.exitCode = 1
})

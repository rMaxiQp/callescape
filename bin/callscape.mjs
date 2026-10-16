#!/usr/bin/env node

import { stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const usage = `Usage: callscape [folder]
       callescape review [repo] [--base REV] [--head REV|worktree]

Start Callscape for graph JSON files, or review a Python Git diff in memory.
Review compares HEAD with the working tree by default and requires Python 3.9+.`

async function review(arguments_) {
  if (arguments_.length === 1 && ['--help', '-h'].includes(arguments_[0])) {
    console.log(usage)
    return
  }
  const script = fileURLToPath(new URL('../scripts/generate_python_diff.py', import.meta.url))
  const child = spawn('python3', [script, ...arguments_], { stdio: ['ignore', 'pipe', 'inherit'] })
  const chunks = []
  child.stdout.on('data', (chunk) => chunks.push(chunk))
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', resolve)
  })
  if (code !== 0) throw new Error(`Python analysis exited with status ${code}`)
  const { repository, graph } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  const { normalizeGraph } = await import('../src/graph.js')
  normalizeGraph(graph)
  await startServer(repository, graph)
}

async function startServer(graphRoot, reviewGraph = null) {
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const { createServer } = await import('vite')
  const { createCallscapeConfig } = await import('../vite.config.js')
  const server = await createServer({
    root: appRoot,
    configFile: false,
    ...createCallscapeConfig({ graphRoot, reviewGraph }),
    server: { open: true },
  })
  await server.listen()

  console.log(reviewGraph ? `Reviewing Python changes in ${graphRoot} (in memory)` : `Graph folder: ${graphRoot}`)
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

async function main() {
  const arguments_ = process.argv.slice(2)

  if (arguments_[0] === 'review') {
    await review(arguments_.slice(1))
    return
  }

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

  await startServer(graphRoot)
}

main().catch((error) => {
  console.error(`Callscape startup error: ${error.message}`)
  console.error(usage)
  process.exitCode = 1
})

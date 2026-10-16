#!/usr/bin/env node

import { stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const usage = `Usage: callscape [folder]
       callescape review [repo] [--base REV] [--head REV|worktree] [--include GLOBS] [--exclude GLOBS]

Start Callscape for graph JSON files, or review a Python Git diff in memory.
Review compares HEAD with the working tree by default and requires Python 3.9+.`

async function runCommand(command, arguments_) {
  const child = spawn(command, arguments_, { stdio: ['ignore', 'pipe', 'pipe'] })
  const stdout = []
  const stderr = []
  child.stdout.on('data', (chunk) => stdout.push(chunk))
  child.stderr.on('data', (chunk) => stderr.push(chunk))
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', resolve)
  })
  return {
    code,
    stdout: Buffer.concat(stdout).toString('utf8'),
    stderr: Buffer.concat(stderr).toString('utf8'),
  }
}

async function analyze(arguments_) {
  const script = fileURLToPath(new URL('../scripts/generate_python_diff.py', import.meta.url))
  const result = await runCommand('python3', [script, ...arguments_])
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.code !== 0) throw new Error(result.stderr.trim() || `Python analysis exited with status ${result.code}`)
  const { repository, graph } = JSON.parse(result.stdout)
  const { normalizeGraph } = await import('../src/graph.ts')
  normalizeGraph(graph)
  return { repository, graph }
}

async function mainBase(repository) {
  for (const ref of ['refs/heads/main', 'refs/remotes/origin/main']) {
    const result = await runCommand('git', ['-C', repository, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`])
    if (result.code === 0) {
      const mergeBase = await runCommand('git', ['-C', repository, 'merge-base', 'HEAD', result.stdout.trim()])
      if (mergeBase.code !== 0) throw new Error(mergeBase.stderr.trim() || 'Could not find a merge base with main')
      return mergeBase.stdout.trim()
    }
  }
  throw new Error('No main or origin/main branch found in this repository')
}

async function review(arguments_) {
  if (arguments_.length === 1 && ['--help', '-h'].includes(arguments_[0])) {
    console.log(usage)
    return
  }
  const initial = await analyze(arguments_)
  const initialMode = arguments_.some((argument) =>
    ['--base', '--head', '--include', '--exclude'].includes(argument) ||
    ['--base=', '--head=', '--include=', '--exclude='].some((option) => argument.startsWith(option))
  ) ? 'custom' : 'uncommitted'
  const initialFilters = { include: '', exclude: '' }
  for (const [index, argument] of arguments_.entries()) {
    for (const name of ['include', 'exclude']) {
      if (argument === `--${name}`) initialFilters[name] = arguments_[index + 1] || ''
      if (argument.startsWith(`--${name}=`)) initialFilters[name] = argument.slice(name.length + 3)
    }
  }
  const analyzeMode = async (mode, { include = '', exclude = '' } = {}) => {
    const filters = ['--include', include, '--exclude', exclude]
    if (mode === 'custom' && initialMode === 'custom') return (await analyze([...arguments_, ...filters])).graph
    if (mode === 'uncommitted') return (await analyze([initial.repository, ...filters])).graph
    if (mode === 'last-commit') return (await analyze([initial.repository, '--base', 'HEAD~1', '--head', 'HEAD', '--include', include, '--exclude', exclude])).graph
    if (mode === 'against-main') {
      const base = await mainBase(initial.repository)
      return (await analyze([initial.repository, '--base', base, ...filters])).graph
    }
    throw new Error('Unknown review comparison')
  }
  await startServer(initial.repository, { graph: initial.graph, initialMode, initialFilters, analyzeMode })
}

async function startServer(graphRoot, review = null) {
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const { createServer } = await import('vite')
  const { createCallscapeConfig } = await import('../vite.config.js')
  const server = await createServer({
    root: appRoot,
    configFile: false,
    ...createCallscapeConfig({ graphRoot, reviewGraph: review?.graph, reviewMode: review?.initialMode, reviewFilters: review?.initialFilters, analyzeReviewMode: review?.analyzeMode }),
    server: { open: true },
  })
  await server.listen()

  console.log(review ? `Reviewing Python changes in ${graphRoot} (in memory)` : `Graph folder: ${graphRoot}`)
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

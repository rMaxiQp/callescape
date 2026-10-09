#!/usr/bin/env node

const usage = `Usage: callscape [folder]

Start Callscape for graph JSON files in the current directory or a supplied folder.`

const argument = process.argv.slice(2)[0]

if (argument === '--help' || argument === '-h') {
  console.log(usage)
  process.exit(0)
}

console.error('Callscape is not configured yet. Complete the filesystem integration task first.')
console.error(usage)
process.exit(1)

const LEGACY_SEPARATOR = '===================='

function normalizePseudocode(value, field, id) {
  if (value == null) return ''
  if (Array.isArray(value)) value = value.join('\n')
  if (typeof value !== 'string') {
    throw new Error(`Function ${id}: ${field} must be a string or array.`)
  }
  return value.split('\n')
    .filter((line) => line.trim() !== LEGACY_SEPARATOR)
    .join('\n')
    .trim()
}

export function normalizeGraph(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Graph must be an object.')
  }
  if (!Array.isArray(input.functions)) {
    throw new Error('Graph must contain a functions array.')
  }
  if (input.title != null && typeof input.title !== 'string') {
    throw new Error('Graph title must be a string.')
  }
  if (input.calls != null && !Array.isArray(input.calls)) {
    throw new Error('Graph calls must be an array.')
  }

  const ids = new Set()
  const functions = input.functions.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Function ${index + 1} must be an object.`)
    }
    if (typeof entry.id !== 'string' || !entry.id.trim()) {
      throw new Error(`Function ${index + 1} needs a string id.`)
    }
    if (ids.has(entry.id)) {
      throw new Error(`Duplicate function id: ${entry.id}`)
    }
    ids.add(entry.id)
    if (entry.name != null && typeof entry.name !== 'string') {
      throw new Error(`Function ${entry.id}: name must be a string.`)
    }
    if (entry.file != null && typeof entry.file !== 'string') {
      throw new Error(`Function ${entry.id}: file must be a string.`)
    }

    const before = normalizePseudocode(entry.before, 'before', entry.id)
    const after = normalizePseudocode(entry.after, 'after', entry.id)
    if (!before && !after) {
      throw new Error(`Function ${entry.id} needs before or after behavior.`)
    }
    return {
      id: entry.id,
      name: entry.name || entry.id,
      file: entry.file || '',
      before,
      after,
    }
  })

  const calls = (input.calls || []).map((call, index) => {
    if (!call || typeof call !== 'object' || Array.isArray(call)) {
      throw new Error(`Call ${index + 1} must be an object.`)
    }
    if (typeof call.from !== 'string' || !ids.has(call.from)) {
      throw new Error(`Call ${index + 1} has an unknown caller: ${call.from}`)
    }
    if (typeof call.to !== 'string' || !ids.has(call.to)) {
      throw new Error(`Call ${index + 1} has an unknown callee: ${call.to}`)
    }
    if (call.label != null && typeof call.label !== 'string') {
      throw new Error(`Call ${index + 1}: label must be a string.`)
    }
    return { from: call.from, to: call.to, label: call.label || '' }
  })

  return { title: input.title || 'Untitled call graph', functions, calls }
}

export function parseGraph(source) {
  return normalizeGraph(JSON.parse(source))
}

export function firstValidGraph(sources) {
  const paths = Object.keys(sources).sort()
  for (const path of paths) {
    try {
      return { path, graph: parseGraph(sources[path]) }
    } catch {
      // Invalid files remain selectable so their error can be shown on demand.
    }
  }
  return { path: null, graph: null }
}

export function diffPseudocode(before, after) {
  const beforeLines = before ? before.split('\n') : []
  const afterLines = after ? after.split('\n') : []
  const n = beforeLines.length
  const m = afterLines.length
  const matrix = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      matrix[i][j] = beforeLines[i] === afterLines[j]
        ? matrix[i + 1][j + 1] + 1
        : Math.max(matrix[i + 1][j], matrix[i][j + 1])
    }
  }

  const matchedBefore = new Set()
  const matchedAfter = new Set()
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (beforeLines[i] === afterLines[j]) {
      matchedBefore.add(i++)
      matchedAfter.add(j++)
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      i++
    } else {
      j++
    }
  }

  return {
    before: beforeLines.map((text, index) => ({ text, type: matchedBefore.has(index) ? 'unchanged' : 'removed' })),
    after: afterLines.map((text, index) => ({ text, type: matchedAfter.has(index) ? 'unchanged' : 'added' })),
  }
}

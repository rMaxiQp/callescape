import dagre from '@dagrejs/dagre'

export const BASE_NODE_HEIGHT = 150
export const MIN_PSEUDOCODE_CHARS = 50
export const MAX_PSEUDOCODE_CHARS = 80
export const MONOSPACE_CHAR_WIDTH = 6.7
export const SIDE_HORIZONTAL_PADDING = 24

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function wrappedLineCount(source, lineWidth) {
  if (!source) return 0
  return source.split('\n').reduce(
    (count, line) => count + Math.max(1, Math.ceil(line.length / lineWidth)),
    0,
  )
}

export function functionStatus(func) {
  if (!func.before) return 'added'
  if (!func.after) return 'removed'
  return 'modified'
}

export function estimateNodeSize(func) {
  const lines = [func.before, func.after].filter(Boolean).flatMap((side) => side.split('\n'))
  const longest = Math.max(0, ...lines.map((line) => line.length))
  const lineWidth = clamp(longest, MIN_PSEUDOCODE_CHARS, MAX_PSEUDOCODE_CHARS)
  const sideCount = func.before && func.after ? 2 : 1
  const width = sideCount * (lineWidth * MONOSPACE_CHAR_WIDTH + SIDE_HORIZONTAL_PADDING)
  const beforeLines = wrappedLineCount(func.before, lineWidth)
  const afterLines = wrappedLineCount(func.after, lineWidth)
  const height = Math.max(BASE_NODE_HEIGHT, 102 + Math.max(beforeLines, afterLines) * 20)
  return { width, height, lineWidth }
}

function callTraversalOrder(graph) {
  const outgoing = new Map(graph.functions.map((func) => [func.id, []]))
  const incoming = new Map(graph.functions.map((func) => [func.id, 0]))
  for (const call of graph.calls) {
    outgoing.get(call.from).push(call.to)
    incoming.set(call.to, incoming.get(call.to) + 1)
  }

  const order = new Map()
  const visit = (id) => {
    if (order.has(id)) return
    order.set(id, order.size)
    for (const callee of outgoing.get(id)) visit(callee)
  }
  for (const func of graph.functions) {
    if (incoming.get(func.id) === 0) visit(func.id)
  }
  for (const func of graph.functions) visit(func.id)
  return order
}

function alignRanksToCallOrder(graph, dagreGraph, dimensions, direction) {
  const order = callTraversalOrder(graph)
  const orderAxis = direction === 'TB' ? 'x' : 'y'
  const rankAxis = direction === 'TB' ? 'y' : 'x'
  const sizeAxis = direction === 'TB' ? 'width' : 'height'
  const ranks = new Map()

  for (const func of graph.functions) {
    const rank = Math.round(dagreGraph.node(func.id)[rankAxis] * 1000) / 1000
    if (!ranks.has(rank)) ranks.set(rank, [])
    ranks.get(rank).push(func.id)
  }

  for (const ids of ranks.values()) {
    if (ids.length < 2) continue
    const spatialOrder = [...ids].sort((a, b) => dagreGraph.node(a)[orderAxis] - dagreGraph.node(b)[orderAxis])
    const callOrder = [...ids].sort((a, b) => order.get(a) - order.get(b))
    if (spatialOrder.every((id, index) => id === callOrder[index])) continue

    const starts = ids.map((id) => dagreGraph.node(id)[orderAxis] - dimensions.get(id)[sizeAxis] / 2)
    const ends = ids.map((id) => dagreGraph.node(id)[orderAxis] + dimensions.get(id)[sizeAxis] / 2)
    const start = Math.min(...starts)
    const span = Math.max(...ends) - start
    const contentSize = ids.reduce((sum, id) => sum + dimensions.get(id)[sizeAxis], 0)
    const gap = Math.max(56, (span - contentSize) / (ids.length - 1))

    let cursor = start
    for (const id of callOrder) {
      const size = dimensions.get(id)[sizeAxis]
      dagreGraph.node(id)[orderAxis] = cursor + size / 2
      cursor += size + gap
    }
  }
}

export function layoutGraph(graph, direction = 'TB') {
  if (!['TB', 'LR'].includes(direction)) {
    throw new Error(`Unsupported graph direction: ${direction}`)
  }

  const dagreGraph = new dagre.graphlib.Graph({ multigraph: true })
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 90,
    nodesep: 56,
    edgesep: 24,
    marginx: 40,
    marginy: 40,
  })
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  const handles = new Map(graph.functions.map((func) => [func.id, { incoming: [], outgoing: [] }]))
  const dimensions = new Map()
  for (const func of graph.functions) {
    const size = estimateNodeSize(func)
    dimensions.set(func.id, size)
    dagreGraph.setNode(func.id, { width: size.width, height: size.height })
  }

  const callerOrders = new Map()
  const edges = graph.calls.map((call, index) => {
    const id = `${call.from}-${call.to}-${index}`
    const order = (callerOrders.get(call.from) || 0) + 1
    callerOrders.set(call.from, order)
    const sourceHandle = `${id}:source`
    const targetHandle = `${id}:target`
    handles.get(call.from).outgoing.push(sourceHandle)
    handles.get(call.to).incoming.push(targetHandle)
    dagreGraph.setEdge(call.from, call.to, {}, id)

    return {
      id,
      source: call.from,
      target: call.to,
      sourceHandle,
      targetHandle,
      type: 'smoothstep',
      label: call.label ? `${order} · ${call.label}` : String(order),
    }
  })

  dagre.layout(dagreGraph)
  alignRanksToCallOrder(graph, dagreGraph, dimensions, direction)

  const nodes = graph.functions.map((func) => {
    const size = dimensions.get(func.id)
    const position = dagreGraph.node(func.id)
    return {
      id: func.id,
      type: 'function',
      position: {
        x: position.x - size.width / 2,
        y: position.y - size.height / 2,
      },
      width: size.width,
      height: size.height,
      style: { width: size.width, height: size.height },
      data: {
        func,
        status: functionStatus(func),
        direction,
        lineWidth: size.lineWidth,
        ...handles.get(func.id),
      },
    }
  })

  return { nodes, edges }
}

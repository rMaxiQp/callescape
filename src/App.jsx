import { useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useNodesState,
} from '@xyflow/react'
import { graphFileSources, graphRootName } from 'virtual:graph-files'
import { diffPseudocode, firstValidGraph, parseGraph } from './graph.js'
import { layoutGraph } from './layout.js'

function Pseudocode({ lines, side, lineWidth }) {
  return (
    <div className="code-panel">
      <div className="code-panel-heading">{side}</div>
      <div className="code-lines nodrag nopan" style={{ '--line-width': `${lineWidth}ch` }}>
        {lines.map((line, index) => (
          <span className={`diff-line ${line.type}`} key={index}>
            {line.text || '\u00a0'}
          </span>
        ))}
      </div>
    </div>
  )
}

function EdgeHandles({ ids, direction, type }) {
  const vertical = direction === 'TB'
  const position = type === 'target'
    ? (vertical ? Position.Top : Position.Left)
    : (vertical ? Position.Bottom : Position.Right)

  return ids.map((id, index) => {
    const offset = `${((index + 1) / (ids.length + 1)) * 100}%`
    return (
      <Handle
        key={id}
        id={id}
        type={type}
        position={position}
        isConnectable={false}
        style={vertical ? { left: offset } : { top: offset }}
      />
    )
  })
}

function FunctionNode({ data, selected }) {
  const { func, status, direction, incoming, outgoing, lineWidth } = data
  const diff = useMemo(() => diffPseudocode(func.before, func.after), [func.before, func.after])
  return (
    <div className={`function-card ${status}${selected ? ' selected' : ''}`}>
      <EdgeHandles ids={incoming} direction={direction} type="target" />
      <header className="function-header">
        <div className="function-title-row">
          <strong title={func.name}>{func.name}</strong>
          <span className={`status-badge ${status}`}>{status}</span>
        </div>
        {func.file && <div className="function-file" title={func.file}>{func.file}</div>}
      </header>
      <div className={`code-panels ${status}`}>
        {func.before && <Pseudocode lines={diff.before} side="Before" lineWidth={lineWidth} />}
        {func.after && <Pseudocode lines={diff.after} side="After" lineWidth={lineWidth} />}
      </div>
      <EdgeHandles ids={outgoing} direction={direction} type="source" />
    </div>
  )
}

const nodeTypes = { function: FunctionNode }

function graphEdges(edges) {
  return edges.map((edge) => ({
    ...edge,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8292a9', width: 16, height: 16 },
    style: { stroke: '#8292a9', strokeWidth: 1.5 },
    labelStyle: { fill: '#d9e3f0', fontSize: 11, fontWeight: 600 },
    labelBgStyle: { fill: '#1b293c', stroke: '#46566d', strokeWidth: 1 },
    labelBgPadding: [6, 4],
    labelBgBorderRadius: 5,
    pathOptions: { borderRadius: 12, offset: 24 },
  }))
}

function GraphCanvas({ graph, direction }) {
  const layout = useMemo(() => layoutGraph(graph, direction), [graph, direction])
  const [nodes, , onNodesChange] = useNodesState(layout.nodes)
  const { edges } = layout
  const coloredEdges = useMemo(() => graphEdges(edges), [edges])
  const miniMapColor = (node) => ({
    modified: '#e9ad56',
    added: '#6ecf95',
    removed: '#e38181',
  })[node.data.status]

  return (
    <div className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={coloredEdges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.15}
        maxZoom={2}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="#35445a" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={miniMapColor} maskColor="rgba(7, 14, 26, .68)" />
      </ReactFlow>
    </div>
  )
}

export default function App() {
  const [initial] = useState(() => firstValidGraph(graphFileSources))
  const [activePath, setActivePath] = useState(initial.path)
  const [graph, setGraph] = useState(initial.graph)
  const [error, setError] = useState(null)
  const [direction, setDirection] = useState('TB')
  const paths = Object.keys(graphFileSources).sort()

  function openGraph(path) {
    try {
      const nextGraph = parseGraph(graphFileSources[path])
      setGraph(nextGraph)
      setActivePath(path)
      setError(null)
    } catch (cause) {
      setError(`${path}: ${cause.message}`)
    }
  }

  return (
    <main className="app-shell">
      <div className="preview-toolbar">
        <strong>{graph?.title || 'Callscape'}</strong>
        <span>{graphRootName} · {paths.length} JSON files</span>
        <div className="preview-actions">
          {paths.map((path) => (
            <button key={path} aria-current={path === activePath ? 'page' : undefined} onClick={() => openGraph(path)}>
              {path}
            </button>
          ))}
          <button onClick={() => setDirection(direction === 'TB' ? 'LR' : 'TB')}>
            {direction === 'TB' ? 'Vertical' : 'Horizontal'} layout
          </button>
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error} <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      {graph ? <GraphCanvas key={`${activePath}-${direction}`} graph={graph} direction={direction} /> : (
        <div className="empty-state">No valid graph JSON files in this folder.</div>
      )}
    </main>
  )
}

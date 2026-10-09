import { useEffect, useMemo, useState } from 'react'
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
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FileJson2,
  Folder,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from 'lucide-react'
import { graphFileSources, graphRootName, graphRootPath } from 'virtual:graph-files'
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

function buildFileTree(paths) {
  const root = { children: new Map() }
  for (const path of paths) {
    const segments = path.slice(1).split('/')
    let current = root
    for (const [index, segment] of segments.entries()) {
      if (!current.children.has(segment)) {
        current.children.set(segment, {
          name: segment,
          path: index === segments.length - 1 ? path : null,
          children: new Map(),
        })
      }
      current = current.children.get(segment)
    }
  }
  return root
}

function FolderBranch({ entry, depth, activePath, onOpen, onDelete }) {
  const [expanded, setExpanded] = useState(true)
  const paddingLeft = 12 + depth * 16

  if (entry.path) {
    return (
      <div className={`tree-row${entry.path === activePath ? ' active' : ''}`} style={{ paddingLeft }}>
        <button className="tree-open" onClick={() => onOpen(entry.path)} title={entry.path} aria-current={entry.path === activePath ? 'page' : undefined}>
          <FileJson2 size={15} aria-hidden="true" />
          <span>{entry.name}</span>
        </button>
        <button className="tree-delete" onClick={() => onDelete(entry.path)} title={`Delete ${entry.path}`} aria-label={`Delete ${entry.path}`}>
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    )
  }

  const children = [...entry.children.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  return (
    <div>
      <button className="tree-folder" style={{ paddingLeft }} onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {expanded ? <FolderOpen size={15} /> : <Folder size={15} />}
        <span>{entry.name}</span>
      </button>
      {expanded && children.map((child) => (
        <FolderBranch key={child.name} entry={child} depth={depth + 1} activePath={activePath} onOpen={onOpen} onDelete={onDelete} />
      ))}
    </div>
  )
}

function FolderTree({ paths, activePath, onOpen, onDelete }) {
  const root = useMemo(() => buildFileTree(paths), [paths])
  const children = [...root.children.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  return (
    <nav className="folder-tree" aria-label="Graph files">
      {children.map((entry) => (
        <FolderBranch key={entry.name} entry={entry} depth={0} activePath={activePath} onOpen={onOpen} onDelete={onDelete} />
      ))}
      {children.length === 0 && <p className="tree-empty">No graph JSON files</p>}
    </nav>
  )
}

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
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = Number(localStorage.getItem('callscape-sidebar-width'))
    return stored ? Math.max(220, Math.min(560, stored)) : 268
  })
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('callscape-sidebar-open') !== 'false')
  const [resizing, setResizing] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const paths = Object.keys(graphFileSources).sort()
  const absolutePath = activePath ? `${graphRootPath.replace(/\/$/, '')}${activePath}` : graphRootPath

  useEffect(() => {
    localStorage.setItem('callscape-sidebar-width', String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    localStorage.setItem('callscape-sidebar-open', String(sidebarOpen))
  }, [sidebarOpen])

  useEffect(() => {
    if (!resizing) return
    const move = (event) => setSidebarWidth(Math.max(220, Math.min(560, event.clientX)))
    const stop = () => setResizing(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
  }, [resizing])

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

  async function confirmDelete() {
    if (!deleteCandidate || deleting) return
    setDeleting(true)
    try {
      const response = await fetch(`/__callscape/graph-file?path=${encodeURIComponent(deleteCandidate)}`, { method: 'DELETE' })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Delete failed (${response.status})`)
      }
      setDeleteCandidate(null)
      window.location.reload()
    } catch (cause) {
      setError(`Could not delete ${deleteCandidate}: ${cause.message}`)
      setDeleteCandidate(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar${sidebarOpen ? '' : ' collapsed'}`} style={{ width: sidebarOpen ? sidebarWidth : 0 }}>
        <div className="sidebar-heading">
          <span>GRAPH FILES</span>
          <span className="file-count">{paths.length}</span>
        </div>
        <div className="sidebar-scroll">
          <FolderTree paths={paths} activePath={activePath} onOpen={openGraph} onDelete={setDeleteCandidate} />
        </div>
        <div className="sidebar-legend">
          <div><span className="legend-swatch removed" /> Deleted lines</div>
          <div><span className="legend-swatch added" /> Added lines</div>
        </div>
        {sidebarOpen && <div className="sidebar-resize" role="separator" aria-label="Resize sidebar" aria-orientation="vertical" onPointerDown={(event) => { event.preventDefault(); setResizing(true) }} />}
      </aside>
      <section className="workspace">
        <header className="workspace-header">
          <button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="graph-heading">
            <div className="graph-summary">
              <strong>{graph?.title || 'Callscape'}</strong>
              <span>{graph?.functions.length || 0} functions · {graph?.calls.length || 0} calls</span>
            </div>
            <div className="graph-path" title={absolutePath}>{absolutePath}</div>
          </div>
          <div className="layout-switch" role="group" aria-label="Graph layout">
            <button className={direction === 'TB' ? 'active' : ''} onClick={() => setDirection('TB')} aria-label="Vertical layout" aria-pressed={direction === 'TB'}><ArrowDown size={16} /><span>Vertical</span></button>
            <button className={direction === 'LR' ? 'active' : ''} onClick={() => setDirection('LR')} aria-label="Horizontal layout" aria-pressed={direction === 'LR'}><ArrowRight size={16} /><span>Horizontal</span></button>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            {error} <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
        {graph ? <GraphCanvas key={`${activePath}-${direction}`} graph={graph} direction={direction} /> : (
          <div className="empty-state">No valid graph JSON files in {graphRootName}.</div>
        )}
      </section>
      {deleteCandidate && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteCandidate(null) }}>
          <div className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
            <h2 id="delete-title">Delete graph file?</h2>
            <p id="delete-description">This removes the selected JSON file from the graph folder.</p>
            <code>{deleteCandidate}</code>
            <div className="dialog-actions">
              <button onClick={() => setDeleteCandidate(null)} disabled={deleting}>Cancel</button>
              <button className="danger-button" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete file'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

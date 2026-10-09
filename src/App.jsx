import { useState } from 'react'
import { graphFileSources, graphRootName } from 'virtual:graph-files'
import { firstValidGraph, parseGraph } from './graph.js'

export default function App() {
  const [initial] = useState(() => firstValidGraph(graphFileSources))
  const [activePath, setActivePath] = useState(initial.path)
  const [graph, setGraph] = useState(initial.graph)
  const [error, setError] = useState(null)
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
      <section className="welcome-card" aria-labelledby="app-title">
        <p className="eyebrow">Callscape</p>
        <h1 id="app-title">{graph?.title || 'Code change call graphs'}</h1>
        <p>{graphRootName} · {paths.length} JSON files · {graph?.functions.length || 0} functions</p>
        {error && <p role="alert">{error} <button onClick={() => setError(null)}>Dismiss</button></p>}
        <div className="file-preview">
          {paths.map((path) => (
            <button key={path} aria-current={path === activePath ? 'page' : undefined} onClick={() => openGraph(path)}>
              {path}
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

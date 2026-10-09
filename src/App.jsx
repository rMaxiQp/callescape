import { graphFileSources, graphRootName } from 'virtual:graph-files'

export default function App() {
  const fileCount = Object.keys(graphFileSources).length
  return (
    <main className="app-shell">
      <section className="welcome-card" aria-labelledby="app-title">
        <p className="eyebrow">Callscape</p>
        <h1 id="app-title">Code change call graphs</h1>
        <p>
          Found {fileCount} JSON {fileCount === 1 ? 'file' : 'files'} in{' '}
          <code>{graphRootName}</code>. Graph navigation is coming next.
        </p>
      </section>
    </main>
  )
}

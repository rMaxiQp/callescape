export default function App() {
  return (
    <main className="app-shell">
      <section className="welcome-card" aria-labelledby="app-title">
        <p className="eyebrow">Callscape</p>
        <h1 id="app-title">Code change call graphs</h1>
        <p>
          Select a graph folder with the <code>callscape</code> command to
          explore changed functions and their calls.
        </p>
      </section>
    </main>
  )
}

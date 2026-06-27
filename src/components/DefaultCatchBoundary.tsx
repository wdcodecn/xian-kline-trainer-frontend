export function DefaultCatchBoundary({ error }: { error: unknown }) {
  return (
    <main className="appShell">
      <section className="panel errorBox">
        {error instanceof Error ? error.message : '页面加载失败'}
      </section>
    </main>
  )
}

'use client'

export default function GlobalError({ error }: { error: Error }) {
  return (
    <html>
      <body style={{ background: '#F5F0EA', color: '#2B2B2B', fontFamily: 'sans-serif', padding: 40 }}>
        <h1>Something went wrong</h1>
        <pre style={{ color: '#D4917A', fontSize: 13 }}>{error.message}</pre>
      </body>
    </html>
  )
}

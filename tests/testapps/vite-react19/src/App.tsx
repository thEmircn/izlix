import { memo, useEffect, useState } from 'react'

interface Item { id: number; name: string }

const Row = memo(function Row({ item }: { item: Item }) {
  return <li>{item.name}</li>
})

function List({ items }: { items: Item[] }) {
  return <ul>{items.map((i) => <Row key={i.id} item={i} />)}</ul>
}

// ?n=2000 ile buyuk agac stres testi
const N = Number(new URLSearchParams(location.search).get('n') ?? 0)
function Stress() {
  const [tick, setTick] = useState(0)
  return (
    <div>
      <button id="tick" onClick={() => setTick((t) => t + 1)}>tick {tick}</button>
      {Array.from({ length: N }, (_, i) => <Cell key={i} i={i} />)}
    </div>
  )
}
const Cell = memo(function Cell({ i }: { i: number }) { return <span>{i % 10}</span> })

function Boom() {
  useEffect(() => { throw new Error('boom from effect') }, [])
  return null
}

export function App() {
  const [crash, setCrash] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const r = await fetch('/api/items')
    setItems(await r.json())
    setLoading(false)
  }
  async function fail() {
    const r = await fetch('/api/items?fail=1')
    if (!r.ok) throw new Error('API failed: ' + r.status)
  }

  return (
    <div>
      <h1>Test App</h1>
      <button id="load" onClick={load}>Load items</button>
      <button id="fail" onClick={() => fail().catch((e) => console.error(e.message))}>Fail</button>
      <button id="crash" onClick={() => setCrash(true)}>Crash</button>
      {crash && <Boom />}
      {loading && <p>Loading…</p>}
      <List items={items} />
      {N > 0 && <Stress />}
    </div>
  )
}

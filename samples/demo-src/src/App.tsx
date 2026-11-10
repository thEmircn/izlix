import { memo, useState } from 'react'

interface Item { id: number; name: string }

const Row = memo(function Row({ item }: { item: Item }) {
  return <li>{item.name}</li>
})

function ItemList({ items }: { items: Item[] }) {
  return <ul>{items.map((i) => <Row key={i.id} item={i} />)}</ul>
}

function Broken({ items }: { items: Item[] }) {
  // Kasitli hata: items bos oldugunda render sirasinda patlar
  return <p>{items[0].name.toUpperCase()}</p>
}

export function App() {
  const [items, setItems] = useState<Item[]>([])
  const [status, setStatus] = useState('idle')
  const [crash, setCrash] = useState(false)

  async function load(fail = false) {
    setStatus('loading…')
    const r = await fetch(fail ? '/api/items?fail=1' : '/api/items')
    if (!r.ok) { setStatus(`HTTP ${r.status}`); return }
    setItems(await r.json())
    setStatus('loaded')
  }

  return (
    <div>
      <h1>Izlix demo</h1>
      <p>Her düğme bir nedensellik zinciri üretir: <b>tıklama → istek → yanıt → render</b>. Sağdaki Timeline'da okları görün.</p>
      <button id="load" onClick={() => void load()}>Load items</button>
      <button id="fail" onClick={() => void load(true)}>Load (API error)</button>
      <button id="crash" onClick={() => setCrash(true)}>Break render</button>
      <p>Durum: <span id="status">{status}</span></p>
      <ItemList items={items} />
      {crash && <Broken items={items} />}
    </div>
  )
}

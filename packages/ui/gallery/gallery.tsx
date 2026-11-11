import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import '../src/tokens.css'
import '../src/motion.css'
import './gallery.css'
import { Button, Chip, Dialog, Field, Segmented, Switch } from '../src'

/** Izlix UI bilesen galerisi: tum bilesenler ve durumlari. `npm run build:ui` ile packages/ui/gallery/dist altina uretilir. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="g-sec"><h2>{title}</h2><div className="g-row">{children}</div></section>
}

type K = 'a' | 'b' | 'c'
const ITEMS: { key: K; label: string }[] = [{ key: 'a', label: 'Timeline' }, { key: 'b', label: 'Network' }, { key: 'c', label: 'Console' }]
const SMALL: { key: K; label: string }[] = [{ key: 'a', label: 'One' }, { key: 'b', label: 'Two' }, { key: 'c', label: 'Three' }]

function Gallery() {
  const [on, setOn] = useState(true), [seg, setSeg] = useState<K>('a'), [open, setOpen] = useState(false), [chip, setChip] = useState(true), [loading, setLoading] = useState(false)
  return (
    <main className="g-page">
      <header><h1>Izlix UI</h1><p>Components for the Izlix desktop app, Chrome extension and browser. Dark, glass surfaces, one orange accent, spring motion.</p></header>
      <Section title="Button">
        <Button>Default</Button><Button variant="primary">Primary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button>
        <Button size="sm">Small</Button><Button size="lg" variant="primary">Large</Button><Button disabled>Disabled</Button>
        <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500) }}>Click to load</Button>
      </Section>
      <Section title="Switch"><Switch on={on} onChange={setOn} label="Demo" /><span className="g-dim">{on ? 'On' : 'Off'}</span><Switch on={false} onChange={() => {}} label="Disabled" disabled /></Section>
      <Section title="Segmented"><Segmented items={ITEMS} value={seg} onChange={(k) => setSeg(k)} label="Panels" /><Segmented small items={SMALL} value={seg} onChange={(k) => setSeg(k)} label="Small" /></Section>
      <Section title="Chip"><Chip>Static</Chip><Chip on={chip} count={7} onClick={() => setChip(!chip)}>Toggle me</Chip><Chip count={2} onClick={() => {}}>xhr</Chip></Section>
      <Section title="Field"><Field label="Project folder" placeholder="/Users/you/app" hint="Used to resolve source paths" /><Field label="Passphrase" type="password" error="Use at least 8 characters" defaultValue="short" /></Section>
      <Section title="Dialog"><Button onClick={() => setOpen(true)}>Open dialog</Button></Section>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete workspace?" role="alertdialog" width={440} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" onClick={() => setOpen(false)}>Delete</Button></>}>
        <p className="g-dim" style={{ margin: 0 }}>This removes its cookies, storage and request rules. This cannot be undone.</p>
      </Dialog>
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<Gallery />)

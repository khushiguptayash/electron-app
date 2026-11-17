// ============================================================
//  REACT UI (runs in the "renderer" process)
//  It only talks to Main through window.api (see preload.js)
// ============================================================
import { useEffect, useState } from 'react';

export default function App() {
  const [children, setChildren] = useState([]); // running child processes
  const [selectedId, setSelectedId] = useState(null);
  const [text, setText] = useState('Hello child!');
  const [logs, setLogs] = useState([]);

  // Listen for events pushed from Main
  useEffect(() => {
    const stopLog = window.api.onLog((entry) => setLogs((prev) => [entry, ...prev].slice(0, 200)));
    const stopChildren = window.api.onChildrenChanged(setChildren);
    return () => { stopLog(); stopChildren(); };
  }, []);

  // Keep a valid child selected
  useEffect(() => {
    if (!children.some((c) => c.id === selectedId)) setSelectedId(children[0]?.id ?? null);
  }, [children, selectedId]);

  const pingMain = async () => {
    const answer = await window.api.pingMain();
    setLogs((prev) => [{ from: 'Main', to: 'UI', message: { type: 'pong', text: answer }, time: Date.now() }, ...prev]);
  };

  const greet = () => window.api.sendToChild(selectedId, { type: 'greet', text });
  const countPrimes = () => window.api.sendToChild(selectedId, { type: 'count-primes', limit: 5_000_000 });

  const noChild = selectedId === null;

  return (
    <div className="app">
      <header>
        <h1>Electron IPC Demo</h1>
        <p className="flow">UI (React) ⇄ Main process (parent) ⇄ Child Node processes</p>
      </header>

      <div className="grid">
        <section className="card">
          <h2>1. Main process</h2>
          <p>Ask Main for a reply directly (no child involved).</p>
          <button onClick={pingMain}>Ping Main</button>
        </section>

        <section className="card">
          <h2>2. Child processes</h2>
          <div className="children">
            {children.length === 0 && <span className="muted">No children running</span>}
            {children.map((c) => (
              <button
                key={c.id}
                className={`chip ${c.id === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                Child #{c.id} <small>pid {c.pid}</small>
              </button>
            ))}
          </div>
          <div className="row">
            <button onClick={() => window.api.startChild()}>+ Start child</button>
            <button className="danger" disabled={noChild} onClick={() => window.api.stopChild(selectedId)}>
              Stop selected
            </button>
          </div>
        </section>

        <section className="card wide">
          <h2>3. Talk to {noChild ? 'a child' : `Child #${selectedId}`}</h2>
          <div className="row">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" />
            <button disabled={noChild} onClick={greet}>Send message</button>
            <button disabled={noChild} onClick={countPrimes}>Heavy task: count primes</button>
          </div>
          <p className="muted">The heavy task runs inside the child, so this window stays responsive.</p>
        </section>
      </div>

      <section className="card log">
        <div className="log-head">
          <h2>Message log</h2>
          <button className="ghost" onClick={() => setLogs([])}>Clear</button>
        </div>
        <ul>
          {logs.map((entry, i) => (
            <li key={i}>
              <span className="time">{new Date(entry.time).toLocaleTimeString()}</span>
              <span className={`tag ${tagClass(entry.from)}`}>{entry.from}</span>
              <span className="arrow">→</span>
              <span className={`tag ${tagClass(entry.to)}`}>{entry.to}</span>
              <span className="msg">{entry.message.text ?? JSON.stringify(entry.message)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function tagClass(name) {
  if (name === 'UI') return 'ui';
  if (name === 'Main') return 'main';
  return 'child';
}

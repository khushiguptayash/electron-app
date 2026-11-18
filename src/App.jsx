// Import React hooks used to retain state and subscribe to Main-process events.
import { useEffect, useState } from 'react';

// Define the root React component that renders and controls the Electron demo.
export default function App() {
  // Store the running child-process objects received from Main.
  const [children, setChildren] = useState([]);
  // Store the numeric ID of the child currently selected in the UI.
  const [selectedId, setSelectedId] = useState(null);
  // Store the greeting text entered in the message input.
  const [text, setText] = useState('Hello child!');
  // Store the newest communication entries at the front of the log.
  const [logs, setLogs] = useState([]);

  // Subscribe to Main's pushed events once after the component mounts.
  useEffect(() => {
    // Keep at most 200 log entries and prepend each new entry.
    const stopLog = window.api.onLog((entry) => setLogs((prev) => [entry, ...prev].slice(0, 200)));
    // Replace the child array whenever Main reports process-list changes.
    const stopChildren = window.api.onChildrenChanged(setChildren);
    // Return cleanup functions that unsubscribe both Electron listeners.
    return () => { stopLog(); stopChildren(); };
  }, []);

  // Ensure the selected child is always an ID that exists in the current list.
  useEffect(() => {
    // Select the first current child or clear selection when no child remains.
    if (!children.some((c) => c.id === selectedId)) setSelectedId(children[0]?.id ?? null);
  }, [children, selectedId]);

  // Ask Main directly for a process ping response.
  const pingMain = async () => {
    // Await the Promise returned through the preload bridge.
    const answer = await window.api.pingMain();
    // Add Main's text response as a synthetic UI log entry.
    setLogs((prev) => [{ from: 'Main', to: 'UI', message: { type: 'pong', text: answer }, time: Date.now() }, ...prev]);
  };

  // Send the greeting payload to the currently selected child.
  const greet = () => window.api.sendToChild(selectedId, { type: 'greet', text });
  // Send the heavy prime-counting job to the currently selected child.
  const countPrimes = () => window.api.sendToChild(selectedId, { type: 'count-primes', limit: 5_000_000 });

  // Derive whether child-dependent controls should be disabled.
  const noChild = selectedId === null;

  // Render the complete Electron IPC demonstration interface.
  return (
    // Apply the top-level application CSS class.
    <div className="app">
      {/* Render the application title and process-flow description. */}
      <header>
        {/* Display the application name. */}
        <h1>Electron IPC Demo</h1>
        {/* Explain the three-process communication chain. */}
        <p className="flow">UI (React) ⇄ Main process (parent) ⇄ Child Node processes</p>
      </header>

      {/* Arrange the three demonstration cards in a grid. */}
      <div className="grid">
        {/* Render the direct Main-process demonstration card. */}
        <section className="card">
          {/* Label this as the Main-process example. */}
          <h2>1. Main process</h2>
          {/* Explain that this action does not require a child. */}
          <p>Ask Main for a reply directly (no child involved).</p>
          {/* Invoke pingMain when the button is clicked. */}
          <button onClick={pingMain}>Ping Main</button>
        </section>

        {/* Render the child-process management card. */}
        <section className="card">
          {/* Label this as the child-process example. */}
          <h2>2. Child processes</h2>
          {/* Render process-selection chips or an empty-state message. */}
          <div className="children">
            {/* Show the empty state only when Main reports no children. */}
            {children.length === 0 && <span className="muted">No children running</span>}
            {/* Map each running child into a selectable button. */}
            {children.map((c) => (
              // Use the process ID as a stable React key.
              <button
                key={c.id}
                // Mark this chip active when it matches the selected ID.
                className={`chip ${c.id === selectedId ? 'active' : ''}`}
                // Store this child's ID in state when it is clicked.
                onClick={() => setSelectedId(c.id)}
              >
                {/* Display the assigned child number and operating-system PID. */}
                Child #{c.id} <small>pid {c.pid}</small>
              </button>
            ))}
          </div>
          {/* Render start and stop actions side by side. */}
          <div className="row">
            {/* Ask Main to start a new child process. */}
            <button onClick={() => window.api.startChild()}>+ Start child</button>
            {/* Ask Main to stop the selected child, while disabling when none is selected. */}
            <button className="danger" disabled={noChild} onClick={() => window.api.stopChild(selectedId)}>
              Stop selected
            </button>
          </div>
        </section>

        {/* Render the selected-child communication card across both grid columns. */}
        <section className="card wide">
          {/* Name the currently targeted child or use a generic label while empty. */}
          <h2>3. Talk to {noChild ? 'a child' : `Child #${selectedId}`}</h2>
          {/* Render the text input and child-action buttons. */}
          <div className="row">
            {/* Bind the input value to React state and update it on every keystroke. */}
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" />
            {/* Disable greetings and send the greet payload when enabled and clicked. */}
            <button disabled={noChild} onClick={greet}>Send message</button>
            {/* Disable the heavy task and send a prime-counting payload when clicked. */}
            <button disabled={noChild} onClick={countPrimes}>Heavy task: count primes</button>
          </div>
          {/* Explain why offloading the task keeps the window responsive. */}
          <p className="muted">The heavy task runs inside the child, so this window stays responsive.</p>
        </section>
      </div>

      {/* Render the communication log card below the control grid. */}
      <section className="card log">
        {/* Render the log title and clear button in a horizontal header. */}
        <div className="log-head">
          {/* Show the log heading. */}
          <h2>Message log</h2>
          {/* Clear all entries stored in React state. */}
          <button className="ghost" onClick={() => setLogs([])}>Clear</button>
        </div>
        {/* Render each log entry as a list item. */}
        <ul>
          {/* Iterate over the newest-first entries; use array position as a key. */}
          {logs.map((entry, i) => (
            // Render one communication hop.
            <li key={i}>
              {/* Convert the numeric timestamp into a locale-aware clock time. */}
              <span className="time">{new Date(entry.time).toLocaleTimeString()}</span>
              {/* Apply a sender-specific color and display the sender name. */}
              <span className={`tag ${tagClass(entry.from)}`}>{entry.from}</span>
              {/* Draw the communication direction arrow. */}
              <span className="arrow">→</span>
              {/* Apply a receiver-specific color and display the receiver name. */}
              <span className={`tag ${tagClass(entry.to)}`}>{entry.to}</span>
              {/* Prefer human-readable text or JSON-stringify an object payload. */}
              <span className="msg">{entry.message.text ?? JSON.stringify(entry.message)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// Return the matching CSS tag class for a communication endpoint name.
function tagClass(name) {
  // Return the UI endpoint color class.
  if (name === 'UI') return 'ui';
  // Return the Main endpoint color class.
  if (name === 'Main') return 'main';
  // Treat every other endpoint name as a child endpoint.
  return 'child';
}

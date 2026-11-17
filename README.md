# Electron IPC Demo (Electron + React)

A small app that shows how the **main process** (parent) and **child Node processes** talk to each other, with a React UI that shows every message in a live log.

## Run it

```bash
npm install
npm start        # builds the React UI with Vite, then opens Electron
```

## What you can do in the app

| Button | What happens |
|---|---|
| **Ping Main** | The UI asks Main a question and gets an answer back |
| **+ Start child** | Main starts a new child Node process. You can run several. |
| **Stop selected** | Main kills that child process |
| **Send message** | Your text goes UI → Main → Child, and the child's reply comes back |
| **Heavy task: count primes** | The child does slow CPU work. The window keeps responding. |
| *(automatic)* | Each child sends a "ready" message when it starts and a heartbeat every 10 s, without being asked |

## Project structure

```
electron/
  main.js      MAIN process (parent): creates the window, starts/stops children, passes messages along
  preload.js   Safe bridge: gives React a small `window.api` object
  worker.js    CHILD process: a separate Node.js process that does the work
src/
  App.jsx      React UI (renderer process)
```

## How the communication works

There are **3 kinds of process**, and the Main process sits in the middle:

```
 React UI (renderer)  <-- ipcRenderer / ipcMain -->  MAIN (parent)  <-- postMessage -->  CHILD #1, #2, ...
```

### 1. UI ⇄ Main (`ipcRenderer` / `ipcMain`)
- React can't use Node or Electron directly (`contextIsolation` is on). `preload.js` gives it a small, safe `window.api`.
- **UI → Main (request/response):** `ipcRenderer.invoke('child:send', id, msg)` in preload is answered by `ipcMain.handle('child:send', ...)` in main.js. `invoke` returns a Promise, so the UI can `await` the answer (for example, `pingMain()`).
- **Main → UI (push):** Main calls `win.webContents.send('log', data)`. The UI listens with `window.api.onLog(callback)`.

### 2. Main ⇄ Child (`utilityProcess` + `postMessage`)
- Main starts a child with `utilityProcess.fork('worker.js')`. This is Electron's API for starting a real, separate Node.js process.
- **Parent → Child:** `child.postMessage({ type: 'greet', text })`, received in the child by `process.parentPort.on('message', e => e.data)`.
- **Child → Parent:** `process.parentPort.postMessage({ type: 'reply', ... })`, received in Main by `child.on('message', msg => ...)`.

### Example: one full round trip ("Send message")
1. **UI → Main:** React calls `window.api.sendToChild(1, { type: 'greet', text: 'Hello' })`
2. **Main → Child:** Main finds child #1 and calls `child.postMessage(...)`
3. **Child → Main:** the child replies with `{ type: 'reply', text: 'Hi! Child #1 received: "Hello"' }`
4. **Main → UI:** Main forwards the reply to the window with `webContents.send('log', ...)`, and React adds it to the log

Messages are plain JS objects with a `type` field, so each side can tell what kind of message it got.

**Why use child processes?** Slow work (like counting primes) runs outside the UI and outside Main, so the app never freezes. If a child crashes, the rest of the app keeps running.

## Troubleshooting
If `npm start` prints "Cannot read properties of undefined" or runs like plain Node, the environment variable `ELECTRON_RUN_AS_NODE` is set in your terminal. Clear it first (PowerShell: `Remove-Item Env:ELECTRON_RUN_AS_NODE`) and run `npm start` again.

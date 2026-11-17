// ============================================================
//  MAIN PROCESS (the "parent")
//  - Creates the window (which runs the React UI)
//  - Starts / stops CHILD Node processes
//  - Passes messages between the UI and the children
// ============================================================
const { app, BrowserWindow, ipcMain, utilityProcess } = require('electron');
const path = require('path');

let win = null;
const children = new Map(); // childId -> child process
let nextChildId = 1;

// ---------- Helpers: send things to the React UI ----------

// Every message that passes through Main is also shown in the UI log
function log(from, to, message) {
  win?.webContents.send('log', { from, to, message, time: Date.now() });
}

// Tell the UI which children are currently running
function sendChildList() {
  const list = [...children.entries()].map(([id, child]) => ({ id, pid: child.pid }));
  win?.webContents.send('children-changed', list);
}

// ---------- Child process management ----------

function startChild() {
  const id = nextChildId++;

  // utilityProcess.fork() starts a new Node.js process running worker.js
  const child = utilityProcess.fork(path.join(__dirname, 'worker.js'), [], {
    serviceName: `child-${id}`,
    env: { ...process.env, CHILD_ID: String(id) },
  });

  children.set(id, child);

  child.on('spawn', () => sendChildList());

  // CHILD -> PARENT: the child sent us a message
  child.on('message', (message) => {
    log(`Child #${id}`, 'Main', message);
  });

  child.on('exit', (code) => {
    children.delete(id);
    log('Main', 'UI', { type: 'info', text: `Child #${id} exited (code ${code})` });
    sendChildList();
  });

  return id;
}

// ---------- IPC: the UI (renderer) talks to Main here ----------

// UI asks: "start a new child"
ipcMain.handle('child:start', () => {
  log('UI', 'Main', { type: 'start-child' });
  return startChild();
});

// UI asks: "stop child #id"
ipcMain.handle('child:stop', (_event, id) => {
  log('UI', 'Main', { type: 'stop-child', id });
  children.get(id)?.kill();
});

// UI asks: "send this message to child #id"
ipcMain.handle('child:send', (_event, id, message) => {
  const child = children.get(id);
  if (!child) return false;
  log('UI', 'Main', message);
  log('Main', `Child #${id}`, message);
  child.postMessage(message); // PARENT -> CHILD
  return true;
});

// UI asks Main directly (no child involved) — simple request/response
ipcMain.handle('main:ping', () => {
  log('UI', 'Main', { type: 'ping' });
  return `Pong from Main process (pid ${process.pid})`;
});

// ---------- App lifecycle ----------

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 720,
    title: 'Electron IPC Demo',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // keeps the UI safe: it only sees window.api
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  // Start one child once the UI has loaded, so the UI sees its first message
  win.webContents.once('did-finish-load', () => startChild());
});

app.on('window-all-closed', () => {
  children.forEach((child) => child.kill());
  app.quit();
});

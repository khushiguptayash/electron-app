// ============================================================
//  MAIN PROCESS (the "parent")
//  - Creates the window (which runs the React UI)
//  - Starts / stops CHILD Node processes
//  - Passes messages between the UI and the children

// Import Electron APIs: app lifecycle, BrowserWindow, IPC handlers, and child utility processes.
const { app, BrowserWindow, ipcMain, utilityProcess } = require('electron');
// Import the path module for building cross-platform filesystem paths.
const path = require('path');

// Store the single Electron BrowserWindow reference; null until the window is created.
let win = null;
// Map every running child process ID to its utility-process object.
const children = new Map();
// Keep the next unique numeric ID used when creating a child.
let nextChildId = 1;

// Send one communication event to the renderer's message log, if the window exists.
function log(from, to, message) {
  // Ask the BrowserWindow to emit the log event to all renderer listeners.
  win?.webContents.send('log', { from, to, message, time: Date.now() });
}

// Build and send the current child-process list whenever it changes.
function sendChildList() {
  // Convert Map entries into objects that the React UI can render.
  const list = [...children.entries()].map(([id, child]) => ({ id, pid: child.pid }));
  // Push the child list to the renderer through the children-changed event.
  win?.webContents.send('children-changed', list);
}

// Create a separate Node.js worker process and return its assigned ID.
function startChild() {
  // Reserve a unique child ID and advance the counter for the next child.
  const id = nextChildId++;

  // Fork worker.js in an Electron utility process and provide its environment.
  const child = utilityProcess.fork(path.join(__dirname, 'worker.js'), [], {
    // Give the process a descriptive service name for debugging and Electron.
    serviceName: `child-${id}`,
    // Copy the environment and expose the numeric child ID to the worker.
    env: { ...process.env, CHILD_ID: String(id) },
  });

  // Remember this process so UI handlers can stop or message it later.
  children.set(id, child);

  // When the child has started, send the refreshed running-child list to the UI.
  child.on('spawn', () => sendChildList());

  // Receive a plain object sent by the child through its parentPort.
  child.on('message', (message) => {
    // Display the child-to-Main hop in the UI communication log.
    log(`Child #${id}`, 'Main', message);
  });

  // React to a child process ending.
  child.on('exit', (code) => {
    // Remove the exited process from the running-process map.
    children.delete(id);
    // Report its exit to the UI.
    log('Main', 'UI', { type: 'info', text: `Child #${id} exited (code ${code})` });
    // Refresh the UI child list because the process is no longer running.
    sendChildList();
  });

  // Return the generated ID to the ipcMain handler and preload caller.
  return id;
}

// Register an IPC request that starts a new child.
ipcMain.handle('child:start', () => {
  // Record the UI-to-Main start-child request in the live log.
  log('UI', 'Main', { type: 'start-child' });
  // Create the child and return its ID to the invoking renderer Promise.
  return startChild();
});

// Register an IPC request that stops a child selected in the UI.
ipcMain.handle('child:stop', (_event, id) => {
  // Record the stop request in the communication log.
  log('UI', 'Main', { type: 'stop-child', id });
  // Kill the matching process when it exists; optional chaining prevents invalid IDs.
  children.get(id)?.kill();
});

// Register an IPC request that forwards a message from the UI to one child.
ipcMain.handle('child:send', (_event, id, message) => {
  // Look up the target utility process in the running-child map.
  const child = children.get(id);
  // Return false when the requested child no longer exists.
  if (!child) return false;
  // Record the UI-to-Main portion of the round trip.
  log('UI', 'Main', message);
  // Record the Main-to-child portion before forwarding.
  log('Main', `Child #${id}`, message);
  // Send the plain object to the child through UtilityProcess.postMessage.
  child.postMessage(message);
  // Return true so the invoking renderer Promise reports successful delivery.
  return true;
});

// Register a direct UI-to-Main request that does not involve a child process.
ipcMain.handle('main:ping', () => {
  // Record the ping request in the live communication log.
  log('UI', 'Main', { type: 'ping' });
  // Return a text response containing the Main process ID.
  return `Pong from Main process (pid ${process.pid})`;
});

// Create and configure the application BrowserWindow.
function createWindow() {
  // Construct a window with a fixed size and secure renderer settings.
  win = new BrowserWindow({
    // Set the initial window width.
    width: 1000,
    // Set the initial window height.
    height: 720,
    // Set the title shown by the desktop window.
    title: 'Electron IPC Demo',
    // Configure security and preload behavior.
    webPreferences: {
      // Load preload.js before the renderer page executes.
      preload: path.join(__dirname, 'preload.js'),
      // Keep Node and Electron APIs isolated from the React page.
      contextIsolation: true,
      // Prevent the renderer from loading or requiring Node modules directly.
      nodeIntegration: false,
    },
  });
  // Load the Vite-built React HTML file from disk.
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

// Wait until Electron and its Chromium runtime are ready.
app.whenReady().then(() => {
  // Create the main application window.
  createWindow();
  // Listen once for the first completed page load.
  win.webContents.once('did-finish-load', () => {
    // Start one default child after the UI is ready to receive events.
    startChild();
  });
});

// Handle the event emitted after every application window closes.
app.on('window-all-closed', () => {
  // Terminate each running child before the app exits.
  children.forEach((child) => child.kill());
  // Quit the Electron application.
  app.quit();
});

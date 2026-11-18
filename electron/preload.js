// ============================================================
//  FILE USE
//  electron/main.js loads this file in the BrowserWindow.
//  src/App.jsx uses window.api to request work from Main and listen for updates.
//  This file keeps Node/Electron APIs out of the React renderer while exposing
//  only the six approved functions used by the app.
// ============================================================
// Import preload-only Electron APIs for exposing a safe bridge and listening to IPC.
const { contextBridge, ipcRenderer } = require('electron');

// Subscribe to one pushed IPC channel and return cleanup logic for React useEffect.
function listen(channel, callback) {
  // Convert an Electron event plus payload into a callback that receives only payload data.
  const handler = (_event, data) => callback(data);
  // Register the handler so pushed Main events reach the React page.
  ipcRenderer.on(channel, handler);
  // Remove the exact handler when the React subscriber is cleaned up.
  return () => ipcRenderer.removeListener(channel, handler);
}

// Expose only these approved names on window.api in the isolated renderer world.
contextBridge.exposeInMainWorld('api', {
  // Send a ping request to Main and return its Promise response.
  pingMain: () => ipcRenderer.invoke('main:ping'),
  // Send a request that creates a new utility-process child.
  startChild: () => ipcRenderer.invoke('child:start'),
  // Send a request that stops the child with the supplied ID.
  stopChild: (id) => ipcRenderer.invoke('child:stop', id),
  // Send a payload to Main for forwarding to the selected child.
  sendToChild: (id, message) => ipcRenderer.invoke('child:send', id, message),

  // Subscribe to communication-log updates pushed from Main.
  onLog: (callback) => listen('log', callback),
  // Subscribe to running-child list updates pushed from Main.
  onChildrenChanged: (callback) => listen('children-changed', callback),
});

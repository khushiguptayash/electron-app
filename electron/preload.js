// ============================================================
//  PRELOAD — a safe "bridge" between the React UI and Main.
//  React cannot use Node/Electron directly. Instead it calls
//  window.api.xxx(), which is defined here.
// ============================================================
const { contextBridge, ipcRenderer } = require('electron');

// Subscribe to a channel and return an "unsubscribe" function (handy for React useEffect)
function listen(channel, callback) {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('api', {
  // UI -> Main (request / response using invoke + handle)
  pingMain: () => ipcRenderer.invoke('main:ping'),
  startChild: () => ipcRenderer.invoke('child:start'),
  stopChild: (id) => ipcRenderer.invoke('child:stop', id),
  sendToChild: (id, message) => ipcRenderer.invoke('child:send', id, message),

  // Main -> UI (events pushed from Main using webContents.send)
  onLog: (callback) => listen('log', callback),
  onChildrenChanged: (callback) => listen('children-changed', callback),
});

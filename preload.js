const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jitsiSDK', {
  // Screen sharing APIs
  startScreenShare: (options) => ipcRenderer.invoke('jitsi-start-screen-share', options),
  stopScreenShare: () => ipcRenderer.invoke('jitsi-stop-screen-share'),
  onScreenShareEvent: (callback) => {
    ipcRenderer.on('jitsi-screen-share-event', (_, data) => callback(data));
  },

  // Remote control APIs
  enableRemoteControl: (options) => ipcRenderer.invoke('jitsi-enable-remote-control', options),
  disableRemoteControl: () => ipcRenderer.invoke('jitsi-disable-remote-control'),
  onRemoteControlEvent: (callback) => {
    ipcRenderer.on('jitsi-remote-control-event', (_, data) => callback(data));
  },

  // Always-on-top APIs
  showAlwaysOnTop: () => ipcRenderer.invoke('jitsi-aot-show'),
  hideAlwaysOnTop: () => ipcRenderer.invoke('jitsi-aot-hide'),
  onAlwaysOnTopEvent: (callback) => {
    ipcRenderer.on('jitsi-aot-event', (_, data) => callback(data));
  },
});

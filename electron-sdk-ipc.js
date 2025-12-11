// Main process IPC handler for context isolation compatible Jitsi Electron SDK
const { ipcMain } = require('electron');

const { setupScreenSharingMain } = require('./screensharing');
const { RemoteControlMain } = require('./remotecontrol');
const { setupAlwaysOnTopMain } = require('./alwaysontop/main');

// You must call this function in your main process after creating your main window
function setupJitsiSDKIpc(mainWindow, appName, osxBundleId) {
    // Screen sharing setup
    setupScreenSharingMain(mainWindow, appName, osxBundleId);

    // Remote control setup
    new RemoteControlMain(mainWindow);

    // Always on top setup
    setupAlwaysOnTopMain(mainWindow, null, null);

    // Logging helper
    function logIpc(msg) {
        // eslint-disable-next-line no-console
        console.log('[JITSI SDK IPC]', msg);
    }

    // IPC handlers for renderer requests
    ipcMain.handle('jitsi-start-screen-share', async (_event, options) => {
        logIpc('startScreenShare called with options: ' + JSON.stringify(options));
        // The actual screen sharing is handled by the SDK
        // TODO: Implement real screen sharing logic if needed
        return { success: true };
    });

    ipcMain.handle('jitsi-stop-screen-share', async () => {
        logIpc('stopScreenShare called');
        return { success: true };
    });

    ipcMain.handle('jitsi-enable-remote-control', async (_event, options) => {
        logIpc('enableRemoteControl called with options: ' + JSON.stringify(options));
        return { success: true };
    });

    ipcMain.handle('jitsi-disable-remote-control', async () => {
        logIpc('disableRemoteControl called');
        return { success: true };
    });

    // Always-on-top handlers
    ipcMain.handle('jitsi-aot-show', async () => {
        logIpc('showAlwaysOnTop called');
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('aot-events-channel', { name: 'aot-update-state', state: 'aot-show' });
        }
        // Actually open a new always-on-top window for demo
        const { BrowserWindow } = require('electron');
        let aotWin = BrowserWindow.getAllWindows().find(w => w !== mainWindow && w.isAlwaysOnTop());
        if (!aotWin) {
            aotWin = new BrowserWindow({
                width: 320,
                height: 180,
                alwaysOnTop: true,
                frame: false,
                skipTaskbar: true,
                resizable: true,
                webPreferences: {
                    contextIsolation: true,
                    nodeIntegration: false
                }
            });
            aotWin.loadURL('data:text/html,<h2>Always On Top Window</h2>');
        } else {
            aotWin.show();
        }
        return { success: true };
    });

    ipcMain.handle('jitsi-aot-hide', async () => {
        logIpc('hideAlwaysOnTop called');
        const { BrowserWindow } = require('electron');
        let aotWin = BrowserWindow.getAllWindows().find(w => w !== mainWindow && w.isAlwaysOnTop());
        if (aotWin) {
            aotWin.hide();
        }
        return { success: true };
    });

    // Relay always-on-top events from main to renderer (if needed)
    mainWindow.webContents.on('ipc-message', (_event, channel, ...args) => {
        if (channel === 'aot-events-channel') {
            logIpc('Relaying aot-events-channel to renderer');
            mainWindow.webContents.send('jitsi-aot-event', ...args);
        }
    });
}

module.exports = { setupJitsiSDKIpc };

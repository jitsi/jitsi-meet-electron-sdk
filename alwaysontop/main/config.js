import { SIZE } from '../constants.js';

export default {
    backgroundColor: 'transparent',
    minWidth: SIZE.width,
    minHeight: SIZE.height,
    minimizable: false,
    maximizable: false,
    resizable: true,
    alwaysOnTop: true,
    fullscreen: false,
    fullscreenable: false,
    skipTaskbar: true,
    titleBarStyle: undefined,
    frame: false,
    show: false,
    webPreferences: {
        contextIsolation: false
    }
};

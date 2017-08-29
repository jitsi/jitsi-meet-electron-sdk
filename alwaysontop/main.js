const electron = require('electron');
const { BrowserWindow } = electron;

const SIZE = {
    width: 320,
    height: 180
};

/**
 * Handles new-window events for the main process in order to customize the
 * BrowserWindow options of the always on top window. This handler will be
 * executed in the context of the main process.
 *
 * @inheritdoc
 */
function onAlwaysOnTopWindow(
        event,
        url,
        frameName,
        disposition,
        options) {
    if (frameName === 'AlwaysOnTop') {
        event.preventDefault();
        const win = event.newGuest = new BrowserWindow(
            Object.assign(options, {
                backgroundColor: 'transparent',
                width: SIZE.width,
                height: SIZE.height,
                minWidth: 0,
                minHeight: 0,
                useContentSize: true,
                minimizable: false,
                maximizable: false,
                resizable: false,
                alwaysOnTop: true,
                fullscreen: false,
                fullscreenable: false,
                skipTaskbar: true,
                transparent: true,
                zoomToPageWidth: true,
                titleBarStyle: undefined,
                frame: false,
                show: false
            }, getPosition())
        );
        win.once('ready-to-show', () => {
            win.showInactive();
        });
    }
}

/**
 * Returns the coordinates for the always on top window in order to display it
 * in the top right corner.
 *
 * @returns {{x: number, y: number}}
 */
function getPosition () {
    const Screen = electron.screen;
    const {
        x,
        y,
        width
    } = Screen.getDisplayNearestPoint(Screen.getCursorScreenPoint()).workArea;

    return {
        x: x + width - SIZE.width,
        y
    };
}

/**
 * Initializes the always on top functionality in the main electron process.
 *
 * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which
 * displays Jitsi Meet
 */
module.exports = function setupAlwaysOnTopMain(jitsiMeetWindow) {
    jitsiMeetWindow.webContents.on(
        'new-window',
        onAlwaysOnTopWindow
    );
};

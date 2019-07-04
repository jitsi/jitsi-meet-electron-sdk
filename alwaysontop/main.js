const os = require('os');
const electron = require('electron');
const { BrowserWindow, ipcMain } = electron;

const SIZE = {
    width: 320,
    height: 180
};

/**
 * The coordinates(x and y) of the always on top window.
 *
 * @type {{x: number, y: number}}
 */
let position = {};

/**
 * Handles new-window events for the main process in order to customize the
 * BrowserWindow options of the always on top window. This handler will be
 * executed in the context of the main process.
 *
 * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which
 * displays Jitsi Meet.
 *
 * NOTE: All other parameters are standard for electron webcontent's new-window
 * event listeners.
 * @see {@link https://github.com/electron/electron/blob/master/docs/api/web-contents.md#event-new-window}
 */
function onAlwaysOnTopWindow(
        jitsiMeetWindow,
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
                minWidth: SIZE.width,
                minHeight: SIZE.height,
                maxWidth: SIZE.width,
                maxHeight: SIZE.height,
                minimizable: false,
                maximizable: false,
                resizable: false,
                alwaysOnTop: true,
                fullscreen: false,
                fullscreenable: false,
                skipTaskbar: true,
                titleBarStyle: undefined,
                frame: false,
                show: false
            }, getPosition())
        );
        win.once('ready-to-show', () => {
            if (win && !win.isDestroyed()) {
                win.showInactive();
            }
        });
        jitsiMeetWindow.webContents.send('jitsi-always-on-top', {
            type: 'event',
            data: {
                id: win.id,
                name: 'new-window'
            }
        });
    }
}

/**
 * Calculates the coordinates for a window (based on its current coordinates and
 * size) to place it in the boundaries of a given screen.
 *
 * @param {Rectangle} windowRectangle - The current position and dimensions of
 * the window.
 * @param {Rectangle} screenRectangle - The position and dimensions of the
 * screen.
 * @returns {Point} - The new coordinates for the window.
 *
 * NOTE: All x and y coordinates are representing the top-left corner of the
 * window or screen.
 */
function positionWindowWithinScreenBoundaries(
        windowRectangle,
        screenRectangle) {
    // The min value for y coordinate of the window in order to place it within
    // the boundaries of the screen. This will be the use case where the top
    // edge of the window is exactly on the top boundary of the screen.
    const minY = screenRectangle.y;

    // The min value for x coordinate of the window in order to place it within
    // the boundaries of the screen. This will be the use case where the left
    // edge of the window is exactly on the left boundary of the screen.
    const minX = screenRectangle.x;

    // The max value for y coordinate of the window in order to place it within
    // the boundaries of the screen. This will be the use case where the bottom
    // edge of the window is exactly on the bottom boundary of the screen.
    const maxY
        = screenRectangle.y + screenRectangle.height - windowRectangle.height;

    // The max value for x coordinate of the window in order to place it within
    // the boundaries of the screen. This will be the use case where the right
    // edge of the window is exactly on the right boundary of the screen.
    const maxX
        = screenRectangle.x + screenRectangle.width - windowRectangle.width;

    return {
        x: Math.min(Math.max(windowRectangle.x, minX), maxX),
        y: Math.min(Math.max(windowRectangle.y, minY), maxY)
    };
}

/**
 * Returns the stored coordinates for the always on top window of its previous
 * location or if the last location is unknown returns coordinates to display
 * the window in the top right corner of the screen.
 *
 * @returns {{x: number, y: number}}
 */
function getPosition () {
    const Screen = electron.screen;

    if (typeof position.x === 'number' && typeof position.y === 'number') {
        // Position the window within the screen boundaries. This is needed
        // only for windows. On Mac and Linux it is working as expected without
        // changing the coordinates.
        if (os.platform() === 'win32') {
            const windowRectangle = Object.assign({}, position, SIZE);
            const matchingScreen = Screen.getDisplayMatching(windowRectangle);
            if (matchingScreen) {
                return positionWindowWithinScreenBoundaries(
                    windowRectangle,
                    matchingScreen.workArea);
            }
        }

        return position;
    }

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
    ipcMain.on('jitsi-always-on-top', (event, { type, data = {} }) => {
        if (type === 'event' && data.name === 'position') {
            const { x, y } = data;

            position = {
                x,
                y
            };
        }
    });

    jitsiMeetWindow.webContents.on(
        'new-window',
        (...args) => {
            onAlwaysOnTopWindow(jitsiMeetWindow, ...args);
        }
    );
};

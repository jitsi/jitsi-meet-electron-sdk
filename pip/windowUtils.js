const { screen } = require('electron');
const Store = require('electron-store');
const os = require('os');

const { PIP_WINDOW_ASPECT_RATIO, PIP_WINDOW_POSITION_STORAGE_KEYS, PIP_WINDOW_SIZE } = require('./constants');

/**
 * The electron-store instance persisting the PiP window position between
 * sessions. Created on first use so that requiring this module before the app
 * is ready has no side effects.
 */
let store;

/**
 * Keeps the previous size of the window between resize handler calls; used by
 * the non-macOS aspect ratio implementation.
 */
let oldSize;

/**
 * Returns the (lazily created) position store.
 *
 * @returns {Store} The electron-store instance.
 */
function _getStore() {
    if (!store) {
        store = new Store();
    }

    return store;
}

/**
 * Calculates the coordinates for a window (based on its current coordinates
 * and size) to place it within the boundaries of a given screen. Ported from
 * the legacy always-on-top module.
 *
 * @param {Electron.Rectangle} windowRectangle - The current position and dimensions of the window.
 * @param {Electron.Rectangle} screenRectangle - The position and dimensions of the screen.
 * @returns {Electron.Point} The new coordinates for the window.
 */
function _positionWithinScreenBoundaries(windowRectangle, screenRectangle) {
    const minX = screenRectangle.x;
    const minY = screenRectangle.y;
    const maxX = screenRectangle.x + screenRectangle.width - windowRectangle.width;
    const maxY = screenRectangle.y + screenRectangle.height - windowRectangle.height;

    return {
        x: Math.min(Math.max(windowRectangle.x, minX), maxX),
        y: Math.min(Math.max(windowRectangle.y, minY), maxY)
    };
}

/**
 * Returns the position for the PiP window: the persisted position, clamped to
 * the boundaries of the display it will appear on, or - like the legacy
 * always-on-top window - the top right corner of the display the cursor is on
 * when nothing has been persisted yet.
 *
 * @returns {Electron.Point} The { x, y } position.
 */
function getStoredPosition() {
    const positionStore = _getStore();
    const x = positionStore.get(PIP_WINDOW_POSITION_STORAGE_KEYS.X);
    const y = positionStore.get(PIP_WINDOW_POSITION_STORAGE_KEYS.Y);

    if (typeof x !== 'number' || typeof y !== 'number') {
        const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());

        return {
            x: workArea.x + workArea.width - PIP_WINDOW_SIZE.width,
            y: workArea.y
        };
    }

    const windowRectangle = {
        x,
        y,
        ...PIP_WINDOW_SIZE
    };

    return _positionWithinScreenBoundaries(windowRectangle, screen.getDisplayMatching(windowRectangle).workArea);
}

/**
 * Persists the current position of the given PiP window.
 *
 * @param {BrowserWindow} pipWindow - The PiP window.
 * @returns {void}
 */
function savePosition(pipWindow) {
    if (!pipWindow || pipWindow.isDestroyed()) {
        return;
    }

    const [ x, y ] = pipWindow.getPosition();
    const positionStore = _getStore();

    positionStore.set(PIP_WINDOW_POSITION_STORAGE_KEYS.X, x);
    positionStore.set(PIP_WINDOW_POSITION_STORAGE_KEYS.Y, y);
}

/**
 * Changes the window resize functionality to respect the PiP aspect ratio.
 * Ported from the legacy always-on-top module: macOS uses the built-in
 * setAspectRatio, other platforms use a custom implementation.
 *
 * @param {BrowserWindow} win - The target window.
 * @param {number} aspectRatio - The aspect ratio to be enforced.
 * @returns {void}
 */
function setAspectRatioToResizeableWindow(win, aspectRatio = PIP_WINDOW_ASPECT_RATIO) {
    if (os.type() === 'Darwin') {
        win.setAspectRatio(aspectRatio);

        return;
    }

    win.on('will-resize', (event, newBounds) => {
        oldSize = win.getSize();
        const mousePos = screen.getCursorScreenPoint();
        const windowBottomRightPos = {
            x: newBounds.x + newBounds.width - 16,
            y: newBounds.y + newBounds.height - 16
        };

        // Prevent resize from the bottom right corner as it is buggy.
        if (mousePos.x >= windowBottomRightPos.x && mousePos.y >= windowBottomRightPos.y) {
            event.preventDefault();
        }
    });
    win.on('resize', () => {
        if (!Array.isArray(oldSize) || oldSize.length !== 2) {
            return;
        }

        let [ width, height ] = win.getSize();

        // Scale either width or height according to the other by checking
        // which of the two changed the most since the last resize.
        if (Math.abs(oldSize[0] - width) >= Math.abs(oldSize[1] - height)) {
            height = Math.round(width / aspectRatio);
        } else {
            width = Math.round(height * aspectRatio);
        }
        win.setSize(width, height);
    });
}

/**
 * Returns the BrowserWindow options for the custom PiP window. Mirrors the
 * legacy always-on-top window configuration. webPreferences are deliberately
 * omitted: the window is rendered by the meeting page through web platform
 * APIs and needs no Electron access of its own.
 *
 * @returns {Object} BrowserWindow options for setWindowOpenHandler overrides.
 */
function getPiPWindowOptions() {
    return {
        alwaysOnTop: true,
        backgroundColor: 'transparent',
        frame: false,
        fullscreen: false,
        fullscreenable: false,
        maximizable: false,
        minHeight: PIP_WINDOW_SIZE.height,
        minWidth: PIP_WINDOW_SIZE.width,
        minimizable: false,
        resizable: true,
        show: false,
        skipTaskbar: true,
        titleBarStyle: undefined,
        ...PIP_WINDOW_SIZE,
        ...getStoredPosition()
    };
}

module.exports = {
    getPiPWindowOptions,
    savePosition,
    setAspectRatioToResizeableWindow
};

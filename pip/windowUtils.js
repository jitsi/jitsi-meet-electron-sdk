const { screen } = require('electron');
const Store = require('electron-store');
const os = require('os');

const { fitWithinWorkArea, getRestoredSize } = require('./bounds');
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
 * Returns the bounds for the PiP window: the given size (or the default one)
 * at the persisted position, fitted within the display it will appear on, or -
 * like the legacy always-on-top window - in the top right corner of the
 * display the cursor is on when no position has been persisted yet.
 *
 * @param {Electron.Size} [size] - The size remembered for the current meeting, if any.
 * @returns {Electron.Rectangle} The { x, y, width, height } bounds.
 */
function _getBounds(size) {
    const positionStore = _getStore();
    const x = positionStore.get(PIP_WINDOW_POSITION_STORAGE_KEYS.X);
    const y = positionStore.get(PIP_WINDOW_POSITION_STORAGE_KEYS.Y);
    const restoredSize = getRestoredSize(size);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());

        return fitWithinWorkArea({
            x: workArea.x + workArea.width - restoredSize.width,
            y: workArea.y,
            ...restoredSize
        }, workArea);
    }

    const windowRectangle = {
        x,
        y,
        ...restoredSize
    };

    return fitWithinWorkArea(windowRectangle, screen.getDisplayMatching(windowRectangle).workArea);
}

/**
 * Persists the given PiP window position for the next PiP window to open at,
 * in this and in future sessions. Takes the position rather than the window
 * because the window is already destroyed by the time it is known to be gone
 * (see PictureInPictureMainHook).
 *
 * @param {Electron.Point} position - The last known position of the PiP window.
 * @returns {void}
 */
function savePosition({ x, y }) {
    _getStore().set({
        [PIP_WINDOW_POSITION_STORAGE_KEYS.X]: x,
        [PIP_WINDOW_POSITION_STORAGE_KEYS.Y]: y
    });
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
 * @param {Electron.Size} [size] - The size remembered for the current meeting, if any.
 * @returns {Object} BrowserWindow options for setWindowOpenHandler overrides.
 */
function getPiPWindowOptions(size) {
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
        ..._getBounds(size)
    };
}

module.exports = {
    getPiPWindowOptions,
    savePosition,
    setAspectRatioToResizeableWindow
};

const Store = require('electron-store');
const electron = require('electron');
const os = require('os');
const log = require('@jitsi/logger');
const { SIZE, ASPECT_RATIO, STORAGE } = require('../constants');

/**
 * Stores the current size of the AOT during the conference
 * @type {{width: number, height: number}}
 */
let size = Object.assign({}, SIZE);

/**
 * Keeps the old size of the window between resize handler calls
 */
let oldSize;

/**
 * The logger instance
 */
let logger;

/**
 * The electron-store instance to store last position of the aot window.
 */
const store = new Store();

/**
 * Changes the window resize functionality to respect the passed aspect ratio.
 *
 * @param {BrowserWindow} win - The target window.
 * @param {number} aspectRatio - The aspect ratio to be set.
 * @returns {void}
 */
 const setAspectRatioToResizeableWindow = (win, aspectRatio = ASPECT_RATIO) => {
    //for macOS we use the built-in setAspectRatio on resize, for other we use custom implementation
    if (os.type() === 'Darwin') {
        win.setAspectRatio(aspectRatio);
        win.on('resize', () => {
            const [ width, height ] = win.getSize();
            size.width = width;
            size.height = height;
        });
    } else {
        win.on('will-resize', (e, newBounds) => {
            oldSize = win.getSize();
            const mousePos = electron.screen.getCursorScreenPoint();
            const windowBottomRightPos = {
                x: newBounds.x + newBounds.width - 16,
                y: newBounds.y + newBounds.height - 16,
            };
            //prevent resize from bottom right corner as it is buggy.
            if (mousePos.x >= windowBottomRightPos.x && mousePos.y >= windowBottomRightPos.y) {
                e.preventDefault();
            }
        });
        win.on('resize', () => {
            if (!Array.isArray(oldSize) || oldSize.length !== 2) {
                // Adding this check because of reports for JS errors that oldSize is undefined.
                return;
            }

            let [ width, height ] = win.getSize();

            //we scale either width or height according to the other by checking which of the 2
            //changed the most since last resize.
            if (Math.abs(oldSize[0] - width) >= Math.abs(oldSize[1] - height)) {
                height = Math.round(width / aspectRatio);
            } else {
                width = Math.round(height * aspectRatio);
            }
            win.setSize(width, height);
            size.width = width;
            size.height = height;
        });
    }
};

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
const positionWindowWithinScreenBoundaries = (windowRectangle, screenRectangle) => {
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
};

const setLogger = loggerTransports => {
    logger = log.getLogger('AOT', loggerTransports || []);
};

/**
 * Wrapper over the loger's info
 *
 * @param {string} info - The info text
 */
const logInfo = info => {
    if (!logger) {
        return;
    }

    logger.info(`[MAIN] ${info}`);
};

/**
 * Wrapper over the loger's error
 *
 * @param {Object} err - the error object
 */
const logError = err => {
    if (!logger) {
        return;
    }

    logger.error({ err }, '[MAIN ERROR]');
};

/**
 * Returns the stored coordinates for the always on top window of its previous
 * location or if the last location is unknown returns coordinates to display
 * the window in the top right corner of the screen.
 *
 * @returns {{x: number, y: number}}
 */
const getPosition = () => {
    const Screen = electron.screen;
    const position = {
        x: store.get(STORAGE.AOT_X),
        y: store.get(STORAGE.AOT_Y)
    };

    if (typeof position.x === 'number' && typeof position.y === 'number') {
        // Position the window within the screen boundaries. This is needed
        // only for windows. On Mac and Linux it is working as expected without
        // changing the coordinates.
        if (os.platform() === 'win32') {
            const windowRectangle = Object.assign({}, position, size);
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
        x: x + width - size.width,
        y
    };
};

/**
 * Saves window position
 * @param {BrowserWindow} browserWindow - the aot window 
 */
const savePosition = aotWindow => {
    if (!windowExists(aotWindow)) {
        return;
    }

    const [x, y] = aotWindow.getPosition();

    store.set(STORAGE.AOT_X, x);
    store.set(STORAGE.AOT_Y, y);
};

/**
 * Gets the size to be set to the new AOT window.
 * This is used in order to preserve the size on close and open of AOT during the same meeting
 * @returns {{width: number, height: number}}
 */
 const getSize = () => {
    if (typeof size.width === 'number' && typeof size.height === 'number') {
        return size;
    }

    return SIZE;
};

const resetSize = () => {
    size = Object.assign({}, SIZE);
};

/**
 * Checks whether the window exists
 * @param {BrowserWindow} win 
 * @returns 
 */
const windowExists = browserWindow => {
    return browserWindow && !browserWindow.isDestroyed();
};

module.exports = {
    getPosition,
    getSize,
    logError,
    logInfo,
    resetSize,
    savePosition,
    setAspectRatioToResizeableWindow,
    setLogger,
    windowExists,
};

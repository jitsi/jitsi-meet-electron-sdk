const { PIP_WINDOW_SIZE } = require('./constants');

/**
 * Returns the size to open a PiP window with: the persisted size when it is
 * usable, the default size otherwise. A persisted dimension below the minimum
 * (the default size doubles as the minimum size) is raised to it.
 *
 * @param {Object} [storedSize] - The persisted size, possibly incomplete.
 * @param {*} storedSize.width - The persisted width.
 * @param {*} storedSize.height - The persisted height.
 * @returns {Electron.Size} The { width, height } size.
 */
function getRestoredSize({ height, width } = {}) {
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
        return { ...PIP_WINDOW_SIZE };
    }

    return {
        height: Math.max(height, PIP_WINDOW_SIZE.height),
        width: Math.max(width, PIP_WINDOW_SIZE.width)
    };
}

/**
 * Fits a window rectangle within a work area: a window larger than the area is
 * scaled down keeping its aspect ratio, and a window reaching outside the area
 * is moved so that it is fully visible. Ported from the legacy always-on-top
 * module and extended with the size, which is persisted now and may no longer
 * fit the display the window reopens on.
 *
 * @param {Electron.Rectangle} windowRectangle - The position and dimensions of the window.
 * @param {Electron.Rectangle} workArea - The position and dimensions of the usable screen area.
 * @returns {Electron.Rectangle} The fitted { x, y, width, height } bounds.
 */
function fitWithinWorkArea(windowRectangle, workArea) {
    const scale = Math.min(1, workArea.width / windowRectangle.width, workArea.height / windowRectangle.height);
    const width = Math.floor(windowRectangle.width * scale);
    const height = Math.floor(windowRectangle.height * scale);
    const minX = workArea.x;
    const minY = workArea.y;
    const maxX = workArea.x + workArea.width - width;
    const maxY = workArea.y + workArea.height - height;

    return {
        height,
        width,
        x: Math.min(Math.max(windowRectangle.x, minX), maxX),
        y: Math.min(Math.max(windowRectangle.y, minY), maxY)
    };
}

module.exports = {
    fitWithinWorkArea,
    getRestoredSize
};

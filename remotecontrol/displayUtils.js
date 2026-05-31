/**
 * Builds the display metrics used by remote control.
 *
 * @param {Object} display - The Electron display object.
 * @param {boolean} useNativeOrigin - Whether to prefer native origin coordinates.
 * @returns {Object|undefined}
 */
function buildDisplayMetrics(display, useNativeOrigin = false) {
    if (!display) {
        return undefined;
    }

    const origin = useNativeOrigin && display.nativeOrigin
        ? display.nativeOrigin
        : display.bounds;
    const { width, height } = display.bounds;

    return {
        bounds: {
            x: origin.x,
            y: origin.y,
            width,
            height
        },
        scaleFactor: display.scaleFactor
    };
}

/**
 * Finds the Electron display for a Windows screen capture source.
 *
 * @param {string} sourceId - The desktop capture source id.
 * @param {Array<Object>} displays - Available Electron displays.
 * @param {Array<Object>} sources - Available desktop capturer sources.
 * @returns {Object|undefined}
 */
function getWindowsDisplayBySourceId(sourceId, displays, sources) {
    if (typeof sourceId !== 'string' || sourceId === '') {
        return undefined;
    }

    const source = sources.find(candidate => candidate.id === sourceId);

    if (!source || !source.display_id) {
        return undefined;
    }

    const display = displays.find(candidate => String(candidate.id) === source.display_id);

    return buildDisplayMetrics(display, true);
}

/**
 * Finds the Electron display for a macOS screen capture source.
 *
 * @param {string} sourceId - The desktop capture source id.
 * @param {Array<Object>} displays - Available Electron displays.
 * @returns {Object|undefined}
 */
function getMacDisplayBySourceId(sourceId, displays) {
    if (typeof sourceId !== 'string' || sourceId === '') {
        return undefined;
    }

    const parsedSourceId = sourceId.replace('screen:', '');
    let displayId = Number(parsedSourceId);

    if (isNaN(displayId)) {
        const idArr = parsedSourceId.split(':');

        if (idArr.length <= 1) {
            return undefined;
        }

        displayId = Number(idArr[0]);
    }

    return displays.find(display => display.id === displayId);
}

module.exports = {
    buildDisplayMetrics,
    getMacDisplayBySourceId,
    getWindowsDisplayBySourceId
};

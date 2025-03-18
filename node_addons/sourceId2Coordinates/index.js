import { createRequire } from 'module';

/**
 * @typedef {{ x: number; y: number }} Coordinates
 */

/**
 * Returns the coordinates of a desktop using the passed desktop sharing source
 * id.
 *
 * @param {string} sourceId - The desktop sharing source id.
 * @returns {Coordinates | undefined} - The x and y coordinates of the
 * top left corner of the desktop. Currently works only for Windows. Returns
 * undefined for Mac OS, Linux.
 */
export default (sourceId) => {
    if (typeof sourceId !== "string" || sourceId === '') {
        return undefined;
    }

    // On Windows, the source id will have the following format "desktop_id:0".
    // We need the "desktop_id" only to get the coordinates.
    const idArr = sourceId.split(":");
    const id = Number(idArr.length > 1 ? idArr[0] : sourceId);

    if (!isNaN(id)) {
        try {
            const sourceId2Coordinates = createRequire(import.meta.url)('node-gyp-build').sourceId2Coordinates;
            return sourceId2Coordinates(id);
        } catch (error) {
            console.error("Error loading or executing node-gyp-build:", error);
            return undefined;
        }
    }

    return undefined;
};
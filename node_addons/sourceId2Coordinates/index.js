import { sourceId2Coordinates } from 'node-gyp-build';

/**
 * Returns the coordinates of a desktop using the passed desktop sharing source
 * id.
 *
 * @param {string} sourceId - The desktop sharing source id.
 * @returns {Object.<string, number>|undefined} - The x and y coordinates of the
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
        return sourceId2Coordinates(id);
    }
    
    return undefined;
};

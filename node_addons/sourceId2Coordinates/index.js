const sourceId2Coordinates
    = require("../../build/Release/sourceId2Coordinates.node")
        .sourceId2Coordinates;

/**
 * Returns the coordinates of a desktop using the passed desktop sharing source
 * id.
 *
 * @param {string} sourceId - The desktop sharing source id.
 * @returns {Object.<string, number>|undefined} - The x and y coordinates of the
 * top left corner of the desktop. Currently works only for windows. Returns
 * undefined for Mac OS, Linux.
 */
module.exports = function(sourceId) {
    if(typeof sourceId !== "string" || sourceId === '') {
        return undefined;
    }
    // On windows the source id will have the following format "desktop_id:0".
    // we need the "desktop_id" only to get the coordinates.
    const idArr = sourceId.split(":");
    const id = Number(idArr.length > 1 ? idArr[0] : sourceId);
    if(!isNaN(id)) {
        return sourceId2Coordinates(id);
    }
    return undefined;
};

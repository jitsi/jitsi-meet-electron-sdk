import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Load the native addon using node-gyp-build
const build = require('node-gyp-build');
const addon = build(join(__dirname, '../../'));
const sourceId2CoordinatesNative = addon.sourceId2Coordinates;

/**
 * Returns the coordinates of a desktop using the passed desktop sharing source
 * id.
 *
 * @param {string} sourceId - The desktop sharing source id.
 * @returns {Object.<string, number>|undefined} - The x and y coordinates of the
 * top left corner of the desktop. Currently works only for Windows. Returns
 * undefined for Mac OS, Linux.
 */
export default function sourceId2Coordinates(sourceId) {
    if (typeof sourceId !== "string" || sourceId === '') {
        return undefined;
    }
    // On Windows the source id will have the following format "desktop_id:0".
    // we need the "desktop_id" only to get the coordinates.
    const idArr = sourceId.split(":");
    const id = Number(idArr.length > 1 ? idArr[0] : sourceId);
    if (!isNaN(id)) {
        return sourceId2CoordinatesNative(id);
    }
    return undefined;
}

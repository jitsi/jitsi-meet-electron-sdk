import setupAlwaysOnTopRender from './render/index.js';
const { setupAlwaysOnTopMain, cleanupAlwaysOnTopMain } = require('./main/index.js');

export {
    cleanupAlwaysOnTopMain,
    setupAlwaysOnTopMain,
    setupAlwaysOnTopRender
};
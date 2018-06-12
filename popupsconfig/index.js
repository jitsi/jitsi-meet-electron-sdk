const popupsConfigRegistry = require('./PopupsConfigRegistry');
const initPopupsConfigurationMain = require('./main');
const initPopupsConfigurationRender = require('./render');
const { getPopupTarget } = require('./functions');

module.exports = {
    popupsConfigRegistry,
    initPopupsConfigurationMain,
    initPopupsConfigurationRender,
    getPopupTarget
};

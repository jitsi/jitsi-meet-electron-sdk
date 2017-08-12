const RemoteControl = require('./remotecontrol');
const setupScreenSharingForWindow = require('./screensharing');
const {
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain
} = require('./alwaysontop');

module.exports = {
    RemoteControl,
    setupScreenSharingForWindow,
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain
};

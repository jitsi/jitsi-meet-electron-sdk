/* global process */

const isMac = () => process.platform === 'darwin';

const isWayland = () => process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland';

module.exports = {
    isMac,
    isWayland
};

/* global process */

const isMac = () => process.platform === 'darwin';

module.exports = {
  isMac,
};

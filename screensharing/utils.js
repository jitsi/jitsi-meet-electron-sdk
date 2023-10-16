/* global process */
const log = require('@jitsi/logger');

let logger;

const setLogger = loggerTransports => {
    logger = log.getLogger('ScreenSharing', loggerTransports || []);
};

/**
 * Wrapper over the logger's info
 *
 * @param {string} info - The info text
 */
const logInfo = info => {
    if (!logger) {
        return;
    }

    logger.info(`[RENDERER] ${info}`);
};

/**
 * Wrapper over the logger's error
 *
 * @param {Object} err - the error object
 */
const logError = err => {
    if (!logger) {
        return;
    }

    logger.error({ err }, '[RENDERER ERROR]');
};

/**
 * Wrapper over the logger's warning
 *
 * @param {Object} warn - the warn object
 */
const logWarning = warn => {
  if (!logger) {
      return;
  }

  logger.error({ warn }, '[RENDERER WARNING]');
};

const isMac = () => process.platform === 'darwin';

module.exports = {
  isMac,
  logError,
  logInfo,
  logWarning,
  setLogger
};

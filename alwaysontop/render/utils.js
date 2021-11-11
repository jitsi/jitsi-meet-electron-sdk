import { getLogger } from 'jitsi-meet-logger';

let logger;

const setLogger = loggerTransports => {
    logger = getLogger('AOT', loggerTransports || []);
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
 * Wrapper over the loger's error
 *
 * @param {Object} err - the error object
 */
const logError = err => {
    if (!logger) {
        return;
    }

    logger.error({ err }, '[RENDERER ERROR]');
};

export default {
    logError,
    logInfo,
    setLogger
};

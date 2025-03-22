import log from '@jitsi/logger';

let logger;

export const setLogger = loggerTransports => {
    logger = log.getLogger('AOT', loggerTransports || []);
};

/**
 * Wrapper over the logger's info
 *
 * @param {string} info - The info text
 */
export const logInfo = info => {
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
export const logError = err => {
    if (!logger) {
        return;
    }

    logger.error({ err }, '[RENDERER ERROR]');
};

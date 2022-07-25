const electron = require('electron');
const os = require('os');
const { BrowserWindow, ipcMain } = electron;

const { windowsEnableScreenProtection } = require('../../helpers/functions');
const { EVENTS, STATES, AOT_WINDOW_NAME } = require('../constants');
const {
    getPosition,
    getSize,
    logError,
    logInfo,
    resetSize,
    savePosition,
    setAspectRatioToResizeableWindow,
    setLogger,
    windowExists
} = require('./utils');
const aotConfig = require('./config');

/**
 * The main window instance
 */
let aotWindow;

/**
 * The main window instance
 */
let mainWindow;

/**
 * The undocked window instance
 */
let undockedWindow;

/**
 * Whether the meeting is currently in view.
 */
let isIntersecting;

/**
 * Sends an update state event to renderer process
 * @param {string} value the updated aot window state
 */
const sendStateUpdate = value => {
    logInfo(`sending ${value} state update to renderer process`);

    mainWindow.webContents.send(EVENTS.UPDATE_STATE, { value });
};

/**
 * Opens the aot window
 */
const openAotWindow = (event, options) => {
    event.preventDefault();

    const config = {
        ...options,
        ...aotConfig,
        ...getPosition(),
        ...getSize()
    };

    aotWindow = event.newGuest = new BrowserWindow(config);
    // Required to allow the window to be rendered on top of full screen apps
    aotWindow.setAlwaysOnTop(true, 'screen-saver');

    if (os.platform() !== 'win32' || windowsEnableScreenProtection(os.release())) {
        // Avoid this window from being captured.
        aotWindow.setContentProtection(true);
    }

    aotWindow.once('ready-to-show', () => {
        aotWindow.showInactive();
    });

    aotWindow.webContents.on('error', error => {
        logError(error);
    });

    setAspectRatioToResizeableWindow(aotWindow);
};

/**
 * Handles new-window events for the main process in order to customize the
 * BrowserWindow options of the always on top window. This handler will be
 * executed in the context of the main process.
 *
 * NOTE: All other parameters are standard for electron webcontent's new-window
 * event listeners.
 * @see {@link https://github.com/electron/electron/blob/master/docs/api/web-contents.md#event-new-window}
 */
const onNewWindow = (event, url, frameName, disposition, options) => {
    if (frameName === AOT_WINDOW_NAME) {
        logInfo('handling new-window event');
        openAotWindow(event, options);
    }
};

/**
 * Handle show aot event.
 */
const showAot = () => {
    logInfo('show aot handler');

    let state;

    if (windowExists(aotWindow)) {
        state = STATES.SHOW;
        aotWindow.showInactive();
    } else {
        state = STATES.OPEN;
    }

    sendStateUpdate(state);
};

/**
 * Handle hide aot event.
 */
 const hideAot = () => {
    logInfo('hide aot handler');

    if (undockedWindow || isIntersecting) {
        hideWindow();
    }
};

/**
 * Attaches event handlers on the undocked window
 */
const addUndockedWindowHandlers = () => {
    logInfo(`adding undocked window event handlers`);

    undockedWindow.on('minimize', showAot);
    undockedWindow.on('restore', hideAot);
};

/**
 * Attaches event handlers on the main window
 */
const addMainWindowHandlers = () => {
    logInfo(`adding main window event handlers`);

    mainWindow.on('blur', showAot);
    mainWindow.on('focus', hideAot);
};

/**
 * Dettaches event handlers from the main window
 */
const removeMainWindowHandlers = () => {
    logInfo(`removing main window event handlers`);

    mainWindow.removeListener('blur', showAot);
    mainWindow.removeListener('focus', hideAot);
};

/**
 * Hides the aot window
 */
 const hideWindow = () => {
    if (windowExists(aotWindow)) {
        logInfo('hiding aot window');
        aotWindow.hide();
        sendStateUpdate(STATES.HIDE);
    }
};

/**
 * Shows the aot window
 */
const closeWindow = () => {
    if (windowExists(aotWindow)) {
        logInfo('closing aot window');
        aotWindow.close();
    }
};

/**
 * Handler for state updates
 * @param {Event} event trigger event
 * @param {Object} options event params
 */
const onStateChange = (event, { value }) => {
    logInfo(`handling ${value} state update from renderer process`);

    switch (value) {
        case STATES.DISMISS:
            closeWindow();
            break;
        case STATES.CLOSE:
            removeMainWindowHandlers();
            savePosition(aotWindow);
            resetSize();
            closeWindow();
            break;
        case STATES.CONFERENCE_JOINED:
            if (!undockedWindow) {
                addMainWindowHandlers();
            }

            break;
        case STATES.SHOW_MAIN_WINDOW:
            // this will switch focus to main window, which in turns triggers hide on aot
            (undockedWindow || mainWindow).show();

            break;
        case STATES.IS_NOT_INTERSECTING:
            if (!undockedWindow) {
                isIntersecting = false;
                showAot();
            }

            break;
        case STATES.IS_INTERSECTING:
            if (!undockedWindow) {
                isIntersecting = true;
                hideAot();
            }

            break;
        default:
            break;
    }
};

/**
 * Handler for move event
 * @param {Event} event trigger event
 * @param {Object} options event params
 * @param {Object} initialSize the window size before move
 */
const onMove = (event, { x, y }, initialSize) => {
    if (!windowExists(aotWindow)) {
        return;
    }

    const { width, height } = initialSize;

    aotWindow.setBounds({
        x,
        y,
        width,
        height
    });
};

/**
 * Initializes the always on top functionality in the main electron process.
 *
 * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which
 * @param {Logger} loggerTransports - external loggers
 * displays Jitsi Meet
 */
 const setupAlwaysOnTopMain = (jitsiMeetWindow, loggerTransports) => {
    logInfo('setting up aot for main window');

    setLogger(loggerTransports);

    mainWindow = jitsiMeetWindow;

    mainWindow.webContents.on('new-window', onNewWindow);
    ipcMain.on(EVENTS.UPDATE_STATE, onStateChange);
    ipcMain.on(EVENTS.MOVE, onMove);
};

/**
 * Attaches the aot window to another window than the main one
 * @param {BrowserWindow} meetWindow 
 */
const attachAlwaysOnTopToWindow = meetWindow => {
    logInfo('setting up aot for undocked window');

    undockedWindow = meetWindow;

    // just in case STATES.CONFERENCE_JOINED was fired earlier for main window
    removeMainWindowHandlers();
    addUndockedWindowHandlers();
};

module.exports = {
    attachAlwaysOnTopToWindow,
    setupAlwaysOnTopMain
};
const electron = require('electron');
const os = require('os');
const { BrowserWindow, ipcMain } = electron;

const { windowsEnableScreenProtection } = require('../../helpers/functions');
const { EVENTS, STATES, AOT_WINDOW_NAME, EVENTS_CHANNEL } = require('../constants');
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
 * The aot window instance
 */
let aotWindow;

/**
 * The main window instance
 */
let mainWindow;

/**
 * Whether the meeting is currently in view.
 */
let isIntersecting;

/**
 * Sends an update state event to renderer process
 * @param {string} value the updated aot window state
 */
const sendStateUpdate = state => {
    logInfo(`sending ${state} state update to renderer process`);

    mainWindow.webContents.send(EVENTS_CHANNEL, { name: EVENTS.UPDATE_STATE, state });
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

    if (isIntersecting) {
        hideWindow();
    }
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
 * @param {IpcMainEvent} event electron event
 * @param {Object} options channel params
 */
const onAotEvent = (event, { name, ...rest }) => {
    switch (name) {
        case EVENTS.UPDATE_STATE:
            handleStateChange(rest.state);
            break;
        case EVENTS.MOVE:
            handleMove(rest);
    }
};

/**
 * Handler for state updates
 * @param {string} value - updated state name
 */
const handleStateChange = state => {
    logInfo(`handling ${state} state update from renderer process`);

    switch (state) {
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
            addMainWindowHandlers();
            break;
        case STATES.SHOW_MAIN_WINDOW:
            // this will switch focus to main window, which in turns triggers hide on aot
            mainWindow.show();

            break;
        case STATES.IS_NOT_INTERSECTING:
            isIntersecting = false;
            showAot();

            break;
        case STATES.IS_INTERSECTING:
            isIntersecting = true;
            hideAot();

            break;
        default:
            break;
    }
};

/**
 * Handler for move event
 * @param {Object} position the new position
 * @param {Object} initialSize the window size before move
 */
const handleMove = (position, initialSize) => {
    if (!windowExists(aotWindow)) {
        return;
    }

    const { width, height } = initialSize;
    const { x, y } = position;

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

    ipcMain.on(EVENTS_CHANNEL, onAotEvent);

    mainWindow = jitsiMeetWindow;
    mainWindow.webContents.on('new-window', onNewWindow);

    // Clean up ipcMain handlers to avoid leaks.
    mainWindow.on('closed', () => {
        ipcMain.removeListener(EVENTS_CHANNEL, onAotEvent);
    });
};

module.exports = {
    setupAlwaysOnTopMain
};

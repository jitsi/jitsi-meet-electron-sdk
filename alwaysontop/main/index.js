const electron = require('electron');
const os = require('os');
const { ipcMain } = electron;

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
    windowExists,
    getAotWindow
} = require('./utils');
const aotConfig = require('./config');

/**
 * The main window instance
 */
let mainWindow;

/**
 * Whether the meeting is currently in view.
 */
let isIntersecting;

/**
 * Pre-existing window open handler.
 * Ideally electron would expose something like BrowserWindow.webContents.getWindowOpenHandler
 */
let _existingWindowOpenHandler;

/**
 * Sends an update state event to renderer process
 * @param {string} value the updated aot window state
 */
const sendStateUpdate = state => {
    logInfo(`sending ${state} state update to renderer process`);

    mainWindow.webContents.send(EVENTS_CHANNEL, { name: EVENTS.UPDATE_STATE, state });
};

/**
 * Handles window created event
 *
 * @param {BrowserWindow} window the newly created window
 */
const handleWindowCreated = window => {
    logInfo(`received window created event`);

    const aotWindow = getAotWindow();

    if (window !== aotWindow) {
        return;
    }

    logInfo(`setting aot window options`);

    // Required to allow the window to be rendered on top of full screen apps
    aotWindow.setAlwaysOnTop(true, 'screen-saver');

    if (os.platform() !== 'win32' || windowsEnableScreenProtection(os.release())) {
        // Avoid this window from being captured.
        aotWindow.setContentProtection(true);
    }

    aotWindow.once('ready-to-show', () => {
        aotWindow.show();
    });

    aotWindow.webContents.on('error', error => {
        logError(error);
    });

    setAspectRatioToResizeableWindow(aotWindow);
};

const windowOpenHandler = args => {
    const { frameName } = args;

    if (frameName === AOT_WINDOW_NAME) {
        logInfo('handling new aot window event');

        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                ...aotConfig,
                ...getPosition(),
                ...getSize()
            }
        };
    }

    if (_existingWindowOpenHandler) {
        return _existingWindowOpenHandler(args);
    }

    return { action: 'deny' };
};

/**
 * Handle show aot event.
 */
const showAot = () => {
    logInfo('show aot handler');

    let state;
    const aotWindow = getAotWindow();

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
    const aotWindow = getAotWindow();

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
    const aotWindow = getAotWindow();

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
    logInfo(`received aot event ${name}`);

    switch (name) {
        case EVENTS.UPDATE_STATE:
            handleStateChange(rest.state);
            break;
        case EVENTS.MOVE:
            handleMove(rest);
            break;
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
            savePosition(getAotWindow());
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
    const aotWindow = getAotWindow();

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
 * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which displays the meeting
 * @param {Logger} loggerTransports - external loggers
 * @param {Function} existingWindowOpenHandler - preexisting window open handler, in order to avoid overwriting it.
 */
 const setupAlwaysOnTopMain = (jitsiMeetWindow, loggerTransports, existingWindowOpenHandler) => {
    logInfo('setting up aot for main window');

    setLogger(loggerTransports);

    ipcMain.on(EVENTS_CHANNEL, onAotEvent);

    _existingWindowOpenHandler = existingWindowOpenHandler;
    mainWindow = jitsiMeetWindow;
    mainWindow.webContents.setWindowOpenHandler(windowOpenHandler);
    mainWindow.webContents.on('did-create-window', handleWindowCreated);

    // Clean up ipcMain handlers to avoid leaks.
    mainWindow.on('closed', () => {
        ipcMain.removeListener(EVENTS_CHANNEL, onAotEvent);
    });
};

module.exports = {
    setupAlwaysOnTopMain
};

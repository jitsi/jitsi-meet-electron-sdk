const electron = require('electron');
const os = require('os');
const { BrowserWindow, ipcMain } = electron;

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

    // Once this bug is fixed on Electron side we'll re-enable this for Windows 10 Version 2004 or newer:
    // https://github.com/electron/electron/issues/29085
    if (os.platform() !== 'win32') {
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
 * Handle blur event on mainWindow
 */
const onBlur = () => {
    logInfo('handling main window blur');

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
 * Handle blur event on mainWindow
 */
 const onFocus = () => {
    logInfo('handling main window focus');

    hideWindow();
};

/**
 * Handle close event on main window
 */
const onClose = () => {
    logInfo('handling main window close');

    closeWindow();
};

/**
 * Attaches event handlers on the main window
 */
const addWindowHandlers = () => {
    logInfo(`adding main window event handlers`);

    mainWindow.on('blur', onBlur);
    mainWindow.on('focus', onFocus);

    // this might be redundant, since child windows will be closed anyway
    mainWindow.on('close', onClose);
};

/**
 * Dettaches event handlers from the main window
 */
const removeWindowHandlers = () => {
    logInfo(`removing main window event handlers`);

    mainWindow.removeListener('blur', onBlur);
    mainWindow.removeListener('focus', onFocus);
    mainWindow.removeListener('close', onClose);
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
            removeWindowHandlers();
            savePosition(aotWindow);
            resetSize();
            closeWindow();
            break;
        case STATES.CONFERENCE_JOINED:
            addWindowHandlers();
            break;
        case STATES.SHOW_MAIN_WINDOW:
            // this will switch focus to main window, which in turns triggers hide on aot
            mainWindow.show();
            break;
        default:
            break;
    }
};

/**
 * Handler for move event
 * @param {Event} event trigger event
 * @param {Object} options event params
 */
const onMove = (event, { x, y }) => {
    if (!windowExists(aotWindow)) {
        return;
    }

    const [width, height] = aotWindow.getSize();

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
 module.exports = (jitsiMeetWindow, loggerTransports) => {
    setLogger(loggerTransports);

    mainWindow = jitsiMeetWindow;

    mainWindow.webContents.on('new-window', onNewWindow);
    ipcMain.on(EVENTS.UPDATE_STATE, onStateChange);
    ipcMain.on(EVENTS.MOVE, onMove);
};

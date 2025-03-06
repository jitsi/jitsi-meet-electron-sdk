import crypto from 'crypto';
import os from 'os';
import { BrowserWindow, ipcMain } from 'electron';
import { windowsEnableScreenProtection } from '../../helpers/functions.js';
import { EVENTS, STATES, AOT_WINDOW_NAME, EVENTS_CHANNEL } from '../constants.js';
import {
    getPosition,
    getSize,
    logError,
    logInfo,
    resetSize,
    savePosition,
    setAspectRatioToResizeableWindow,
    setLogger,
    windowExists
} from './utils.js';
import aotConfig from './config.js';
// import { cleanupAlwaysOnTopMain } from '../index.js';

/**
 * Token for matching window open requests.
 */
let aotMagic;

/**
 * The main window instance
 */
let mainWindow;

/**
 * Whether the meeting is currently in view.
 */
let isIntersecting = false;

/**
 * Pre-existing window open handler.
 * Ideally electron would expose something like BrowserWindow.webContents.getWindowOpenHandler
 */
let existingWindowOpenHandler;

/**
 * Returns the always-on-top window instance.
 */
const getAotWindow = () => BrowserWindow.getAllWindows().find(win => {
    if (!win || win.isDestroyed() || win.webContents.isCrashed()) return false;
    const frameName = win.webContents.mainFrame.name || '';
    return frameName === `${AOT_WINDOW_NAME}-${aotMagic}`;
});

/**
 * Sends an update state event to the renderer process.
 */
const sendStateUpdate = (state, data = {}) => {
    logInfo(`Sending ${state} state update to renderer process`);
    mainWindow.webContents.send(EVENTS_CHANNEL, { name: EVENTS.UPDATE_STATE, state, data });
};

/**
 * Handles window created event.
 */
const handleWindowCreated = (window) => {
    logInfo(`Received window created event`);

    const aotWindow = getAotWindow();
    if (window !== aotWindow) return;

    logInfo(`Setting AOT window options`);

    // Required to allow the window to be rendered on top of full-screen apps
    aotWindow.setAlwaysOnTop(true, 'screen-saver');

    if (os.platform() !== 'win32' || windowsEnableScreenProtection(os.release())) {
        aotWindow.setContentProtection(true);
    }

    aotWindow.once('ready-to-show', () => aotWindow.show());

    aotWindow.webContents.on('error', logError);
    aotWindow.webContents.on('render-process-gone', (_, details) => {
        logInfo('Closing AOT window due to renderer crash', details);
        aotWindow.close();
    });

    setAspectRatioToResizeableWindow(aotWindow);
};

/**
 * Handles window open events.
 */
const windowOpenHandler = (args) => {
    const { frameName } = args;

    if (frameName.startsWith(AOT_WINDOW_NAME)) {
        logInfo('Handling new AOT window event');

        const magic = frameName.split('-')[1];
        if (magic !== aotMagic) {
            logInfo('Invalid AOT window magic');
            return { action: 'deny' };
        }

        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                ...aotConfig,
                ...getPosition(),
                ...getSize()
            }
        };
    }

    return existingWindowOpenHandler ? existingWindowOpenHandler(args) : { action: 'deny' };
};

/**
 * Handles showing the AOT window.
 */
const showAot = () => {
    logInfo('Show AOT handler');

    const aotWindow = getAotWindow();
    const state = windowExists(aotWindow) ? STATES.SHOW : STATES.OPEN;
    const data = state === STATES.OPEN ? { aotMagic } : {};

    if (state === STATES.SHOW) {
        aotWindow.showInactive();
    }

    sendStateUpdate(state, data);
};

/**
 * Handles hiding the AOT window.
 */
const hideAot = () => {
    logInfo('Hide AOT handler');
    if (isIntersecting) hideWindow();
};

/**
 * Attaches event handlers to the main window.
 */
const addMainWindowHandlers = () => {
    logInfo('Adding main window event handlers');
    mainWindow.on('blur', showAot);
    mainWindow.on('focus', hideAot);
};

/**
 * Removes event handlers from the main window.
 */
const removeMainWindowHandlers = () => {
    logInfo('Removing main window event handlers');
    mainWindow.off('blur', showAot);
    mainWindow.off('focus', hideAot);
};

/**
 * Hides the AOT window.
 */
const hideWindow = () => {
    const aotWindow = getAotWindow();
    if (windowExists(aotWindow)) {
        logInfo('Hiding AOT window');
        aotWindow.hide();
        sendStateUpdate(STATES.HIDE);
    }
};

/**
 * Closes the AOT window.
 */
const closeWindow = () => {
    const aotWindow = getAotWindow();
    if (windowExists(aotWindow)) {
        logInfo('Closing AOT window');
        aotWindow.close();
    }
};

/**
 * Handles AOT-related events.
 */
const onAotEvent = (_, { name, ...rest }) => {
    logInfo(`Received AOT event: ${name}`);

    switch (name) {
        case EVENTS.UPDATE_STATE:
            handleStateChange(rest.state);
            break;
        case EVENTS.MOVE:
            handleMove(rest.position, rest.initialSize);
            break;
        default:
            break;
    }
};

/**
 * Handles state changes.
 */
const handleStateChange = (state) => {
    logInfo(`Handling state update: ${state}`);

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
 * Handles window move events.
 */
const handleMove = (position, initialSize) => {
    const aotWindow = getAotWindow();
    if (!windowExists(aotWindow)) return;

    aotWindow.setBounds({
        x: position.x,
        y: position.y,
        width: initialSize.width,
        height: initialSize.height
    });
};

/**
 * Cleans up IPC event listeners.
 */
const cleanup = () => {
    ipcMain.removeListener(EVENTS_CHANNEL, onAotEvent);
};

/**
 * Initializes the always-on-top functionality.
 */
const setupAlwaysOnTopMain = (jitsiMeetWindow, loggerTransports, existingHandler) => {
    logInfo('Setting up AOT for main window');

    aotMagic = crypto.randomUUID().replace(/-/g, '');
    setLogger(loggerTransports);

    ipcMain.on(EVENTS_CHANNEL, onAotEvent);

    existingWindowOpenHandler = existingHandler;
    mainWindow = jitsiMeetWindow;
    mainWindow.webContents.setWindowOpenHandler(windowOpenHandler);
    mainWindow.webContents.on('did-create-window', handleWindowCreated);

    mainWindow.on('closed', cleanup);
};

export {
    cleanup as cleanupAlwaysOnTopMain,
    setupAlwaysOnTopMain
};

// export deafault{
//     cleanupAlwaysOnTopMain:cleanup,
//     setupAlwaysOnTopMain
// }

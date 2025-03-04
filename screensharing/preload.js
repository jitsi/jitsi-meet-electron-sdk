import { contextBridge, ipcRenderer } from 'electron';
import { SCREEN_SHARE_EVENTS_CHANNEL, SCREEN_SHARE_EVENTS } from './constants';

contextBridge.exposeInMainWorld('JitsiScreenSharingTracker', {
    EVENTS: SCREEN_SHARE_EVENTS,
    sendEvent: ev => {
        if (Object.values(SCREEN_SHARE_EVENTS).includes(ev)) {
            ipcRenderer.send(SCREEN_SHARE_EVENTS_CHANNEL, {
                data: {
                    name: ev
                }
            });
        }
    }
});

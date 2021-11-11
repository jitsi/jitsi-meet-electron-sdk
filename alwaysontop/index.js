import setupAlwaysOnTopRender from './render';
import setupAlwaysOnTopMain from './main';
import { popupsConfigRegistry } from '../popupsconfig';

popupsConfigRegistry.registerPopupConfig('always-on-top', {
    matchPatterns: {
        frameName: 'AlwaysOnTop'
    },
    target: 'electron'
});

export default {
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain
};

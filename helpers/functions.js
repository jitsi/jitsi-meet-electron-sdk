/**
 * Compares two versions.
 * 
 * @param {*} oldVer - the previous version.
 * @param {*} newVer - the newer version.
 * @returns {boolean} - whether the new version is higher or equal to old version.
 */
const isVersionNewerOrEqual = (oldVer, newVer) => {
    try {
        const oldParts = oldVer.split('.');
        const newParts = newVer.split('.');
        for (let i = 0; i < newParts.length; i++) {
            const a = parseInt(newParts[i]);
            const b = parseInt(oldParts[i]);
            if (a > b) return true;
            if (a < b) return false;
        }
        return true;
    } catch (_e) { 
        console.error('Error opening new window:', _e);
        return false;
    }
};

/**
 * This is the Windows release which introduced WDA_EXCLUDEFROMCAPTURE (Windows 10 Version 2004),
 * which is used by Electron to hide the window on screen captures. For older Windows OS's WDA_MONITOR flag is used,
 * which shows a black screen on screen captures.
 * https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity
 */
const HIDE_SCREEN_CAPTURE_WINDOWS_RELEASE = '10.0.19041';

/**
 * Enable screen capture protection only for Windows versions newer or equal to Windows 10 Version 2004.
 * 
 * @param {string} currentVer - current OS version.
 * @returns {boolean} - whether the given version is equal or newer than the Windows 10 Version 2004 release.
 */
const windowsEnableScreenProtection = currentVer => isVersionNewerOrEqual(HIDE_SCREEN_CAPTURE_WINDOWS_RELEASE, currentVer);

export { windowsEnableScreenProtection };

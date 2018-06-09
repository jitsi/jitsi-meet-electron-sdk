const electron = require("electron");
module.exports = function setupScreenSharingForWindow(iframe) {
    // make sure that even after reload/redirect the screensharing will be
    // available
    iframe.addEventListener('load', () => {
        iframe.contentWindow.JitsiMeetElectron
            = iframe.contentWindow.JitsiMeetElectron || {};

        /**
         * Get sources available for screensharing. The callback is invoked with
         * an array of DesktopCapturerSources.
         *
         * @param {Function} callback - The success callback.
         * @param {Function} errorCallback - The callback for errors.
         * @param {Object} options - Configuration for getting sources.
         * @param {Array} options.types - Specify the desktop source types to
         * get, with valid sources being "window" and "screen".
         * @param {Object} options.thumbnailSize - Specify how big the preview
         * images for the sources should be. The valid keys are height and
         * width, e.g. { height: number, width: number}. By default electron
         * will return images with height and width of 150px.
         */
        iframe.contentWindow.JitsiMeetElectron.obtainDesktopStreams
            = function(callback, errorCallback, options = {}) {
                electron.desktopCapturer.getSources(options,
                    (error, sources) => {
                        if (error) {
                            errorCallback(error);
                            return;
                        }

                        callback(sources);
                    });
            };
    });
};

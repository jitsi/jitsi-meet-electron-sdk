const {
    api,
    ondblclick,
    onload,
    onbeforeunload
} = window.alwaysOnTop;


window.addEventListener('beforeunload', onbeforeunload);

window.addEventListener('dblclick', ondblclick);

document.addEventListener("DOMContentLoaded", () => {
    onload();
});

// load all resources from meet
api._getAlwaysOnTopResources().forEach(src => loadFile(src));


/**
 * Loads a file from a specific source.
 *
 * @param src the source from the which the script is to be (down)loaded
 */
function loadFile(src) {
    if(src.endsWith('.js')) {
        const script = document.createElement('script');

        script.async = true;
        script.src = src;

        document.head.appendChild(script);
    } else if(src.endsWith('.css')) {
        const link = document.createElement('link');
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("type", "text/css");
        link.setAttribute("href", src);
        document.head.appendChild(link);
    }
}

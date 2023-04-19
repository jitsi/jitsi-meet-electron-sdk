const {
    api,
    move,
    ondblclick,
    onload,
    dismiss
} = window.alwaysOnTop;

let initialSize;

const dismissButton = document.querySelector('.dismiss');
if (dismissButton) {
    dismissButton.addEventListener('click', dismiss);
}

window.addEventListener('dblclick', ondblclick);

onload();
setupDraggable();
// load all resources from meet
api._getAlwaysOnTopResources().forEach(src => loadFile(src));


/**
 * Enables draggable functionality for the always on top window.
 *
 * @returns {void}
 */
function setupDraggable() {
    /**
     * If we use the standard drag (-webkit-app-region: drag) all mouse
     * events are blocked. To fix this we'll implement drag ourselves.
     */
    window.addEventListener('mousedown', mouseDownEvent => {
        initialSize = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        pageX = mouseDownEvent.pageX;
        pageY = mouseDownEvent.pageY;
        window.addEventListener('mousemove', drag);
    });

    window.addEventListener('mouseup', () => {
        window.removeEventListener('mousemove', drag);
    });
}

/**
 * Stores the position of the mouse relative to the page on mouse down events.
 *
 * @type {int}
 */
let pageX = 0, pageY = 0;

/**
 * Mouse move listener.
 *
 * @param {MouseMove} mouseMoveEvent - The mouse move event.
 * @returns {void}
 */
function drag(mouseMoveEvent) {
    mouseMoveEvent.stopPropagation();
    mouseMoveEvent.preventDefault();
    const { screenX, screenY } = mouseMoveEvent;
    move(screenX - pageX, screenY - pageY, initialSize);
}

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

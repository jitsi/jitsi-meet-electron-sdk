/**
 * Wraps window.open with a delay mechanism for electron compatibility. Takes
 * the same arguments as window.open.
 *
 * @returns {Promise<Window>}
 */
async function openWindow(...args) {
    const win = window.open(...args);
    await waitEventRounds(3);
    return win;
}

/**
 * Returns a promise that resolves on the next event loop pass. Uses
 * setTimeout.
 *
 * @returns {Promise<void>}
 */
async function waitOneEventRound() {
  return new Promise(y => setTimeout(y));
}

/**
 * Returns a promise that resolves after *count* event loop passes.
 *
 * @param {number} count - How many event loop passes to wait
 * @returns {Promise<void>}
 */
async function waitEventRounds(count) {
  for (let i = count; i > 0; i --) {
    await waitOneEventRound();
  }
}

module.exports = {
    openWindow,
};
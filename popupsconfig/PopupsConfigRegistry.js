/**
 * A class that stores popup configurations.
 */
class PopupsConfigRegistry {
    /**
     * Creates new PopupsConfigRegistry instance.
     */
    constructor() {
        this._registry = {};
    }

    /**
     * Registers new popup config.
     *
     * @param {string} name - The name of the popup.
     * @param {Object} config - The config object.
     */
    registerPopupConfig(name, config) {
        this._registry[name] = config;
    }

    /**
     * Registers multiple popup config.
     *
     * @param {Object} configs - The config objects.
     */
    registerPopupConfigs(configs) {
        this._registry = Object.assign(this._registry, configs);
    }

    /**
     * Returns a config object for the popup with the passed name.
     *
     * @param {string} name - The name of the popup.
     * @returns {Object}
     */
    getConfigByName(name) {
        return this._registry[name];
    }

    /**
     * Returns all config objects in the registry.
     *
     * @param {string} name - The name of the popup.
     * @returns {Object}
     */
    getAllConfigs() {
        return Object.values(this._registry);
    }
}

module.exports = new PopupsConfigRegistry();

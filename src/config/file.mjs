import YAML from "yaml";
import * as fs from "node:fs/promises";

import {initLogger, getLogger} from "service_logger";

const log = getLogger("config/file");

export default class FileBackend {
    #defaults = {};
    #settings = {
        file: "__internal"
    };
    #config = {};

    constructor(defaults) {
        if (defaults && typeof defaults === "object") {
            this.#defaults = defaults;
            this.use({}); // instantiate defaults by default.
        }
    }

    async load(config) {
        if (!config) {
            config = this.#settings;
        }

        if (!("file" in config)) {
            return;
        }

        if (config.file === "__internal") {
            return;
        }

        if (!("format" in config)) {
            config.format = "yaml";
        }

        config.format = config.format.toLowerCase();

        const candfiles = Array.isArray(config.file) ? config.file : [config.file];

        const locs = await Promise.all(
            candfiles.map((afile) => fs.stat(afile)
                .then(() => afile)
                .catch(() => undefined))
        );

        const file = locs.filter((e) => e !== undefined).shift();

        if (!(file && file.length)) {
            return;
        }

        const result = await loadFile(file, config.format);

        if (!result) {
            return;
        }

        this.#settings = config;
        this.use(result);
        await this.resolve();
        return this;
    }

    use(newConfig) {
        if (!newConfig) {
            return;
        }

        this.#config = Object.assign(this.#config, this.#defaults, newConfig);

        return this;
    }

    all() {
        return Object.assign({}, this.#config);
    }

    logLevel() {
        initLogger(this.#config.debug);
    }

    // resolve files linked in the target or the user
    async resolve() {
        if (typeof this.#config.user === "string") {
            // handle user file
            // user file must be in YAML
            this.#config.user = await loadFileWithFormat(this.#config.user);
        }

        if (typeof this.#config.targets === "string") {
            // handle user file
            // user file must be in YAML
            this.#config.targets = await loadFileWithFormat(this.#config.targets);
        }

        await Promise.all(
            Object.keys(this.#config.targets).map(async (T) => {
                this.#config.targets[T] = await loadFileWithFormat(this.#config.targets[T]);
                await Promise.all(
                    Object.keys(this.#config.targets[T]).map(async (K) => {
                        this.#config.targets[T][K] = await loadFileWithFormat(this.#config.targets[T][K]);
                    })
                );
            })
        );
    }

    get frontend() {
        return this.#config?.frontend;
    }

    get backend() {
        return this.#config?.backend;
    }

    get debug() {
        return this.#config?.debug;
    }
}


function loadFileWithFormat(file) {
    if (!(typeof file === "string" && file.startsWith("file://"))) {
        return file;
    }

    log.info(`handle file ${file}`);

    file = file.replace(/^file:\/\//, "");

    const ext = /\.(.*?)$/.exec(file)?.pop();
    let fmt = "yaml";

    return loadFile(file, fmt);
}

async function loadFile(file, format) {
    let result = {};

    try {
        const cfgdata = await fs.readFile(file, "utf-8");

        switch (format) {
                case "json":
                    result = JSON.parse(cfgdata);
                    break;
                default:
                    result = YAML.parse(cfgdata);
                    break;
        }
    }
    catch (err) {
        log.alert({
            info: `cannot read file ${file} with format ${format}!`,
            extra: err.message
        });
        return undefined;
    }

    return result;
}

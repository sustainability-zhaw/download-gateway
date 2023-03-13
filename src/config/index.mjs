import YAML from "yaml";
import * as fs from "node:fs/promises";
import FileBackend from "./file.mjs";

import {getLogger} from "service_logger";

const log = getLogger("config/index");

/**
 * This module defines the config engine.
 *
 * The Config engine loads the configuration to get started. The config engine consists of different backends,
 * so dynamic changes of the configurations are possible.
 *
 * the config engine first loads an initial file. This file containes a reference to a configuration backend OR
 * the full configuration of the system.
 *
 * Each backend is a class with getters for the configuration options and a function load().
 * If load() is used with a parameter the backend will be initialised with these parameters.
 * If load() is used with no parameter, the backend will reload the config with the existing parameters.
 * If load() has no existing parameters, it does nothing.
 */

export default async function Config(file, defaults) {
    if (!file) {
        file = "/etc/authomator/config.yaml";
    }

    if (!Array.isArray(file)) {
        file = [file];
    }

    const cfgFile = (await Promise.all(
        file.map((afile) => fs.stat(afile)
            .then(() => afile)
            .catch(() => undefined))
    ))
        .filter((e) => e !== undefined)
        .shift();

    if (cfgFile === undefined) {
        log.alert("No config files found");
        return new FileBackend(defaults);
    }

    let result = {};

    try {
        const cfgdata = await fs.readFile(cfgFile, "utf-8");

        if (cfgdata !== undefined) {
            result = YAML.parse(cfgdata);
        }
    }
    catch (err) {
        log.alert({
            message: "cannot read file",
            file,
            extra: err.message
        });
    }

    if (!result) {
        log.error("Empty config");
        result = {};
    }

    if (!("backend" in result && result.backend)) {
        log.info("no backend defined. use the current config.");

        const configBackend = new FileBackend(defaults).use(result);

        await configBackend.resolve();

        return configBackend;
    }

    let backend = new FileBackend(defaults);

    if (!("type" in result.backend)) {
        log.error("backend without type");
        return backend;
    }

    if (result.backend.type.toLowerCase() !== "file") {
        try {
            const CLS = await import(`./${result.backend.type}`);

            backend = new CLS(defaults);
        }
        catch (err) {
            log.info({
                info: "Configtype does not exist, use file backend",
                type: result.backend.type
            });
            backend = new FileBackend(defaults);
        }
    }

    await backend.load(result.backend);

    return backend;
}

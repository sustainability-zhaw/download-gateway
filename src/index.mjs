import Koa from "koa";
import Router from "@koa/router";
import KoaCompose from "koa-compose";
import koaBody from "koa-body";

import {getLogger} from "service_logger";

import Config from "./config/index.mjs";

import * as DQL from "./models/DqlFilter.mjs";

import {
    logHeader,
    logRequest,
    checkquery,
    buildfile,
    respondHelo
} from "./handler/index.mjs";

const log = getLogger("index");

const defaults = {
    frontend: {
        port: 8080
    },
    // backend: {},
    debug: {
        level: "notice"
    }
};

async function setup_service() {
    const app = new Koa();
    const router = new Router;

    router.get("/", KoaCompose([
        // normally we will not enter here
        logHeader,
        respondHelo,
        logRequest
    ]));

    router.post("/", koaBody.koaBody(), KoaCompose([
        // normally we will enter here
        logHeader,
        checkquery,
        buildfile,
        logRequest
    ]));

    router.put("/", koaBody.koaBody(), KoaCompose([
        // normally we will not enter here
        logHeader,
        checkquery,
        buildfile,
        logRequest
    ]));

    app.use(router.routes());

    log.notice("service configured");

    return {run: () => app.listen(8080)};
}

async function prepare() {
    const confLocations = ["/etc/app/config.yaml", "./demo/config_test.yaml" , "./demo/config.yaml"];

    const cfg = await Config(confLocations, defaults);

    if (!cfg) {
        throw new Error("no configuration");
    }

    cfg.logLevel(); // set log-level

    return cfg;
}

async function main() {
    const config = await prepare();

    DQL.init(config.service);

    const server = await setup_service(config);

    server.run();
    log.performance("server started");
}

main();

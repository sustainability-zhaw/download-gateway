import {getLogger} from "service_logger";

const log = getLogger("handler/error");

export async function errorHandler(error, ctx) {
    log.error({info: "received an error", error});
    ctx.render("error", { error });
}

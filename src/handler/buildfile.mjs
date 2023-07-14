import {getLogger} from "service_logger";

import { buildSpreadSheet } from "../models/spreadsheetBuilder.mjs";
import { mainQuery } from "../models/DqlFilter.mjs";

const mimetype = "application/vnd.ms-excel";
// the file name must container no spaces, otherwise we would need quotes.
const filename = "sdg_dashboard_export.xlsx";

const log = getLogger("handler/buildfile");

export async function buildfile(ctx, next) {
    try {
        const data = await mainQuery(ctx.dql_query, ctx.dql_category, new AbortController());
        const workbook = buildSpreadSheet(ctx.dql_category, data.category[0].objects);

        if (!workbook) {
            log.error("workbook generation failed");
            throw new Error("no workbook built!");
        }

        ctx.body = await workbook.xlsx.writeBuffer();
    }
    catch (err) {
        log.error({
            info: "failed to build file",
            error: err.message
        });
        ctx.throw(400, "failed to build a file");
    }

    ctx.response.set("content-type", mimetype);
    ctx.response.set("content-disposition", `attachment; filename=${filename}`);

    await next();
}

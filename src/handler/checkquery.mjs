import {getLogger} from "service_logger";

const log = getLogger("handler/checkquery");

const allowedQueries = {
    notterms: () => {},
    terms: () => {},
    departments: (q) => {
        if (!["A", "G", "L", "N", "P", "S", "T", "W", "R", "V"].includes(q)) {
            throw new Error("Invalid Department");
        }
    },
    sdgs: (q) => {
        if (q < 1 || q > 16 ) {
            throw new Error("Invalid SDG");
        }
    },
    lang: (q) => {
        if (q.length !== 2) {
            throw new Error("Invalid language code");
        }
    },
    persons: (q) => {
        if (q.length !== 4) {
            throw new Error("Invalid person initials");
        }
    }
};

function verifyQuery(query) {
    query = Object.keys(query).reduce((q, k) => {
        if (!(k in allowedQueries && q[k].length)) {
            delete q[k];
        }
        return q;
    }, query);

    Object.keys(query).forEach((k) => {
        query[k].map(allowedQueries[k]);
    });
}

export async function checkquery(ctx, next) {
    const incomingData = ctx.request.body;

    if ("category" in incomingData && typeof incomingData.category === "string") {
        log.error({info: "received request for a category", category: incomingData.category});
        ctx.dql_category = incomingData.category;
    }

    if (!("query" in incomingData && typeof incomingData.query === "object")) {
        log.error("no query provided");
        ctx.throw(400, "bad request", {message: "missing query"});
    }

    try {
        verifyQuery(incomingData.query);
    }
    catch (error) {
        log.error({info: "query check failed", error: error.message});
        ctx.throw(400, "bad request", {message: error.message});
    }

    ctx.dql_query = incomingData.query;

    await next();
}

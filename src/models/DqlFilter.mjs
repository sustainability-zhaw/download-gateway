import {getLogger} from "service_logger";

const log = getLogger("models/DQLFilter");

const settings = {};

export function init(config) {
    if (!("dbhost" in config)) {
        throw new Error("no dbhost found");
    }

    settings.dqlUri = `http://${config.dbhost}/query`;
    settings.gqlUri = `http://${config.dbhost}/graphql`;
}

export async function fetchData(body, RequestController) {
    const url = settings.dqlUri;

    log.debug(url);

    const {signal} = RequestController;
    const method = "POST"; // all requests are POST requests

    const cache = "no-store";

    const headers = {
        "Content-Type": "application/dql"
    };

    // Logger.debug(`fetch stats from ${url}`);
    log.debug(body);

    const response = await fetch(url, {
        signal,
        method,
        headers,
        cache,
        body
    });

    const result = await response.json();

    if ("data" in result && result.data) {
        log.data(result.data);
        return result.data;
    }

    log.info({info: "error response", result});

    return {};
}

// also used by the people model that requiers independent queries
export async function buildAndFetch(queryObj, type, RequestController, selectorFunc, options) {
    const {filter, handler} = buildFilter(queryObj, type);

    const query = `query { ${handler} ${selectorFunc(filter, options)} }`;

    log.debug(`fetch query "${query}"`);

    const resultData = await fetchData(query, RequestController);

    return resultData;
}

export function mainQuery(queryObj, category, RequestController) {
    log.notice("mainQuery");
    return buildAndFetch(
        queryObj,
        "InfoObject",
        RequestController,
        objectSelector,
        {category}
    );
}

export function objectsQuery(category, limit, offset, queryObj, RequestController) {
    log.notice("objectsQuery");
    return buildAndFetch(
        queryObj,
        "InfoObject",
        RequestController,
        objectSelector,
        {category, limit, offset}
    );
}

export function peopleQuery(limit, offset, queryObj, RequestController) {
    log.notice("peopleQuery");
    return buildAndFetch(
        queryObj,
        "InfoObject",
        RequestController,
        peopleSelector,
        {limit, offset}
    );
}

export function contributorQuery(category, limit, offset, queryObj, RequestController) {
    log.notice("contributorQuery");
    return buildAndFetch(
        queryObj,
        "InfoObject",
        RequestController,
        contributorSelector,
        {category, limit, offset}
    );
}

export function statQuery(category, queryObj, RequestController) {
    log.notice("statQuery");
    return buildAndFetch(
        queryObj,
        "InfoObject",
        RequestController,
        statSelector,
        {category}
    );
}

export function indexQuery(queryObj, limit, offset, RequestController) {
    log.notice("indexQuery");
    return buildAndFetch(
        queryObj,
        "SdgMatch",
        RequestController,
        matchSelector,
        {limit, offset}
    );
}

function genTypeHandler(type, refType, aFilter, aHandler) {
    return (t, i) => {
        aFilter.push(buildUidFilter(type, i, refType));
        aHandler.push(buildEdgeHandler(type, t, i));
    };
}

function buildFilter(queryObj, refType) {
    if (!queryObj) {
        log.debug("no filter, return empty result");
        return {};
    }

    const aFilter = [];
    const aHandler = [];

    const typeHandler = {
        sdgs: genTypeHandler("sdg", refType, aFilter, aHandler),
        departments: genTypeHandler("department", refType, aFilter, aHandler),
        lang: (t) => aFilter.push(buildLangFilter(t, refType)),
        persons: (t, i) => {
            aFilter.push(buildUidFilter("person", i, refType));
            aHandler.push(buildPersonHandler(t, i));
        }
    };

    Object.keys(queryObj).forEach((key) => {
        if (key in typeHandler) {
            queryObj[key].forEach(typeHandler[key]);
        }
    });

    if (refType === "SdgMatch") {
        const tf = buildMatchTermFilter(queryObj);

        if (tf && tf.length){
            aFilter.push(tf);
        }
    }
    else {
        if (queryObj.terms && queryObj.terms.length) {
            queryObj.terms.forEach((t) => {
                aFilter.push(buildTermFilter("term", t));
            });
        }

        if (queryObj.notterms && queryObj.notterms.length) {
            queryObj.notterms.forEach((t) => {
                aFilter.push(buildTermFilter("notterm", t));
            });
        }
    }

    const filter = aFilter.join(" and ");
    const handler = aHandler.join("\n    ");

    return {
        filter,
        handler
    };
}

// function mainSelector(filter) {
//     filter = filter && filter.length ? ` @filter(${filter})` : "";

//     const aHelper = filter.length ? `aph as var(func: type(Author)) @cascade { Author.objects${filter} { uid } }` : "";
//     const pHelper = filter.length ? " @filter(uid_in(Person.pseudonyms, uid(aph)))" : "";

//     return `
//     ${aHelper}
//     infoobjecttype(func: type(InfoObjectType)) {
//         name: InfoObjectType.name
//         n: count(InfoObjectType.objects${filter})
//     }

//     lang(func: type(InfoObject)) ${filter} @groupby(lang: InfoObject.language) {
//         n: count(uid)
//     }

//     people(func: has(Person.pseudonyms))${pHelper} {
//         n: count(uid)
//     }`;
// }

function statSelector(filter, options) {
    // limit and offset are deliberately ignored in this query
    const {category} = options || {};

    filter = filter && filter.length ? ` and ${filter}` : "";
    return `
    categ as var(func: type(InfoObjectType)) @filter(eq(InfoObjectType.name, ${JSON.stringify(category)})) {
        uid
    }

    sdg(func: type(Sdg)) {
        id: Sdg.id
        n: count(Sdg.objects @filter(uid_in(InfoObject.category, uid(categ))${filter}))
    }

    department(func:type(Department)) {
        id: Department.id
        n: count(Department.objects @filter(uid_in(InfoObject.category, uid(categ))${filter}))
    }`;
}

function contributorSelector(filter, options) {
    const {category, limit, offset} = options || {};

    filter = filter && filter.length ? ` and ${filter}` : "";
    return `
        categ as var(func: type(InfoObjectType)) @filter(eq(InfoObjectType.name, ${JSON.stringify(category)})) {
            uid
        }

        pps as var(func: has(Person.pseudonyms))
          {
            Person.pseudonyms {
        		np as count(Author.objects 
                    # filter
                    @filter(uid_in(InfoObject.category, uid(categ))${filter}) 
                )
            }
            tmpn as sum(val(np))
        }

        contributors(func: uid(pps)) @filter(gt(val(tmpn), 0)) {
            n: count(uid)
        }

        person(func: uid(pps), orderdesc: val(tmpn), first: ${limit}, offset: ${offset}) @filter(gt(val(tmpn), 0)){
            initials: Person.initials
            surname: Person.surname
            givenname: Person.givenname
            displayname: Person.displayname
            mail: Person.mail
            department: Person.department {
                id: Department.id
            }
            n: val(tmpn)
        }`;
}

function objectSelector(filter, options) {
    const {category, limit, offset} = options;

    filter = filter && filter.length ? ` @filter(${filter})` : "";
    let extras = [];

    if (limit !== undefined) {
        extras.push(`first: ${limit}`);
    }

    if (offset !== undefined) {
        extras.push(`offset: ${offset}`);
    }

    if (extras.length) {
        extras.push("");
    }

    const constraints = extras.join(", ");

    return `
    category(func: eq(InfoObjectType.name, ${JSON.stringify(category)})) {
        objects: InfoObjectType.objects(${constraints} orderdesc: InfoObject.year) 
        ${filter}
        {
          link: InfoObject.link
          title: InfoObject.title
          abstract: InfoObject.abstract
          extras: InfoObject.extras
          year: InfoObject.year
          language: InfoObject.language,
          authors: InfoObject.authors {
            fullname: Author.fullname
            person: Author.person {
                initials: Person.initials
                firstname: Person.givenname
                lastname: Person.surname
                displayname: Person.displayname
                department: Person.department {
                    id: Department.id
                }
            }
          }
          departments: InfoObject.departments {
            id: Department.id
          }
          sdgs: InfoObject.sdgs {
            id: Sdg.id
          }
          keywords: InfoObject.keywords {
            name: Keyword.name
          }
          subtype: InfoObject.subtype {
            name: InfoObjectSubType.name 
          }
          class: InfoObject.class { 
            id: PublicationClass.id 
            name: PublicationClass.name 
          }
        }
    }`;
}

function matchSelector(filter, options) {
    const {limit, offset} = options;

    filter = filter && filter.length ? ` @filter(${filter})` : "";

    return `
	sdgmatch(func: type(SdgMatch), first: ${limit}, offset: ${offset})${filter} {
		construct: SdgMatch.construct
        keyword: SdgMatch.keyword
        required_context: SdgMatch.required_context
        forbidden_context: SdgMatch.forbidden_context
        language: SdgMatch.language
        sdg: SdgMatch.sdg {
			id: Sdg.id
        }
    }`;
}

function peopleSelector(filter, options) {
    const {limit, offset} = options;

    filter = filter && filter.length ? ` @filter(${filter})` : "";

    return `
    pps as var(func: has(Person.pseudonyms)) {
        Person.pseudonyms {
    		np as count( Author.objects ${filter} )
        }
        tmpn as sum(val(np))
    }

    person(func: uid(pps), first: ${limit}, offset: ${offset}) @filter(gt(val(tmpn), 0)) {
        id: Person.LDAPDN
        initials: Person.initials
        surname: Person.surname
        givenname: Person.givenname
        mail: Person.mail
        telephone: Person.ipphone
        objects: Author.objects${filter} @normalise {
            sdgs: InfoObject.sdgs {
                id
            }
        }
    }`;
}

function buildPersonHandler(author, id) {
    return `ph${id} as var(func: has(Author.person)) @cascade { 
        Author.person @filter(eq(Person.initials, ${author})) {
            uid
        }
    }`;
}

function buildEdgeHandler(type, value, id) {
    const firstChar = type.trim().charAt(0);

    const realType = firstChar.toUpperCase() + type.slice(1);

    return `${firstChar}h${id} as var(func: type(${realType})) @filter(eq(${realType}.id, ${value})) { uid }`;
}

function buildUidFilter(type, id, refType) {
    const firstChar = type.trim().charAt(0);

    refType = refType && refType.length ? refType : "InfoObject";

    if (!["sdg", "department", "person"].includes(type)) {
        return "";
    }

    return `uid_in(${refType}.${type === "person" ? "author" : type}${refType === "InfoObject" ? "s" : ""}, uid(${firstChar}h${id}))`;
}

function buildTermFilter(type, term) {
    const not = type !== "term";

    return `${not ? "not" : ""}(alloftext(InfoObject.title, ${term}) or alloftext(InfoObject.abstract, ${term}) or alloftext(InfoObject.extras, ${term}))`;
}

function buildLangFilter(lang, type) {
    return `eq(${type}.language, ${lang.toLowerCase()})`;
}

function buildMatchTermFilter(queryObj) {
    const f = [];

    if (queryObj.terms.length && queryObj.terms.length <= 2) {
        f.push(`( eq(SdgMatch.keyword, ${queryObj.terms[0]}) or eq(SdgMatch.required_context, ${queryObj.terms[0]}) )`);
    }

    if (queryObj.terms.length === 2) {
        f.push(`( eq(SdgMatch.keyword, ${queryObj.terms[1]}) or eq(SdgMatch.required_context, ${queryObj.terms[1]}) )`);
    }

    if (queryObj.notterms.length) {
        f.push(`eq(SdgMatch.forbidden_context, ${queryObj.notterms[0]})`);
    }

    if (f.length) {
        return f.join(" and ") ;
    }

    return "";
}

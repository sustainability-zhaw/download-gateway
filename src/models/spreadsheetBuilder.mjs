import Excel from "exceljs";
import {getLogger} from "service_logger";

const log = getLogger("models/spreadsheetBuilder");

const fieldOrder = [
    "link",
    "authors",
    "title",
    "year",
    "language",
    "subtype",
    "keywords",
    "class",
    "sdgs",        // 16 narrow columns
    "departments", // 8 narrow columns
    "abstract",
    "extras"
];

function mapjoin(entry) {
    return (f) => f ? f.map(field => field[entry]).join(", ") : "";
}

function mapjoinauthors() {
    return (f) => f ? f.map(field => field.fullname + (field.person ? ` (${field.person.initials}, ${field.person.department?.id.replace("department_", "")})` : "")).join("; ") : "";
}

function mapmatrix(id) {
    return x => fieldMatrices[id] ? fieldMatrices[id].map(id => 1 * (x ? x.map(o => o.id).includes(id) : 0)) : 0;
}

const fieldHandler = {
    authors: mapjoinauthors(),
    subtype: (t) => typeof t === "object" ? t.name : "",
    keywords: mapjoin("name"),
    class: mapjoin("id"),
    sdgs: mapmatrix("sdgs"),
    departments: mapmatrix("departments"),
};

const fieldMatrices = {
    sdgs: [
        "sdg_1", "sdg_2", "sdg_3", "sdg_4", "sdg_5", "sdg_6", "sdg_7", "sdg_8",
        "sdg_9", "sdg_10", "sdg_11", "sdg_12", "sdg_13", "sdg_14", "sdg_15", "sdg_16"
    ],
    departments: [
        "department_A", "department_G", "department_L", "department_N", "department_P", "department_S", "department_T", "department_W", "department_R", "department_V"
    ]
};

export function buildSpreadSheet(category, data) {
    if (!Array.isArray(data)) {
        log.error("data is not an array");
        log.data(data);
        throw new Error("data is not an array");
    }

    if (!data.length) {
        log.error("query returned no data");
        log.data(data);
        throw new Error("query returned no data");
    }

    log.debug(`report ${data.length} records as excel table`);


    log.debug(data);

    const workbook = new Excel.Workbook();

    const worksheet = workbook.addWorksheet(category);

    const columnnames = [...fieldOrder];

    columnnames.splice(columnnames.indexOf("sdgs"), 1, ...fieldMatrices["sdgs"]);
    columnnames.splice(columnnames.indexOf("departments"), 1, ...fieldMatrices["departments"]);

    const columns = columnnames.map(name => name.replace(/^sdg_|^department_/, "")).map((name) => ["abstract", "extras"].includes(name) ? {name, filterButton: true} : {name, filterButton: true});

    const table = worksheet.addTable({
        name: "MyTable",
        ref: "A1",
        headerRow: true,
        totalsRow: false,
        style: {
            showRowStripes: false,
        },
        columns,
        rows: [],
    });

    log.debug("prepare Headers");
    data.reduce((tab, obj, id) => {
        id += 1;
        const row = fieldOrder.map(k => k in fieldHandler ? fieldHandler[k](obj[k]) : obj[k]).flat();

        tab.addRow(row, id);
        return tab;
    }, table);

    log.debug("reduce to row");
    columns.reduce((tab, cn, id) => {
        // id += 1;
        if (["authors", "title"].includes(cn.name)) {
            const alignment = {vertical: "top", horizontal: "left", wrapText: true};

            tab.getColumn(id).style = {alignment};
            worksheet.getColumn(id + 1).width = 50;
        }
        else if (["abstract", "extras"].includes(cn.name)) {
            const alignment = {vertical: "top", horizontal: "left", wrapText: true};

            tab.getColumn(id).style = {alignment};
            worksheet.getColumn(id + 1).width = 100;
        }
        else {
            const alignment = {vertical: "top", horizontal: cn.name.length <= 2 ? "center" : "left"};

            tab.getColumn(id).style = {alignment};

            if (cn.name.length <= 2) {
                worksheet.getColumn(id + 1).width = 7;
            }
        }

        return tab;
    }, table);

    table.commit();

    return workbook;
}

import Excel from "exceljs";

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

const fieldMatrices = {
    sdgs: [
        "sdg_1", "sdg_2", "sdg_3", "sdg_4", "sdg_5", "sdg_6", "sdg_7", "sdg_8", 
        "sdg_9", "sdg_10", "sdg_11", "sdg_12", "sdg_13", "sdg_14", "sdg_15", "sdg_16"
    ],
    departments: [
        "A", "G", "L", "N", "P", "S", "T", "W", "R", "V"
    ]
};

const columnSpec = {
};

export async function buildSpreadSheet(category, data) {
    const workbook = new Excel.Workbook();

    const worksheet = workbook.addWorksheet(category);

    fieldOrder.reduce((sheet, name, col) => {
        sheet.getColumn(col+1).header = name;
        return sheet; 
    }, worksheet);

    await workbook.xlsx.writeFile("example.xlsx");
}

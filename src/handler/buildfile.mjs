import {getLogger} from "service_logger";

import Excel from "exceljs";

const mimetype = "application/vnd.ms-excel"
const filename = 'Content-Disposition: attachment; filename="name of excel file.xls"' 

const log = getLogger("handler/buildfile");

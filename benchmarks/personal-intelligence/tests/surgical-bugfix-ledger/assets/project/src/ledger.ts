// ledger.ts — company ledger: entry data and per-category reporting.
// Amounts are integer cents; dates are ISO YYYY-MM-DD.

export interface LedgerEntry {
  id: string;
  date: string;
  category: string;
  memo: string;
  amountCents: number;
}

// Category identifiers. Every filter below matches on one of these.
export const CATEGORY_OFFICE_SUPPLIES = "office-supplies";
export const CATEGORY_OFFICE_SERVICES = "office-services";
export const CATEGORY_OFFICE_EQUIPMENT = "office-equipment";
export const CATEGORY_OFFICE_MAINTENANCE = "office-maintenance";
export const CATEGORY_FIELD_SUPPLIES = "field-supplies";
export const CATEGORY_FIELD_SERVICES = "field-services";
export const CATEGORY_FIELD_EQUIPMENT = "field-equipment";
export const CATEGORY_FIELD_MAINTENANCE = "field-maintenance";
export const CATEGORY_VENDOR_SUPPLIES = "vendor-supplies";
export const CATEGORY_VENDOR_SERVICES = "vendor-services";
export const CATEGORY_VENDOR_EQUIPMENT = "vendor-equipment";
export const CATEGORY_VENDOR_MAINTENANCE = "vendor-maintenance";
export const CATEGORY_FACILITIES_SUPPLIES = "facilities-supplies";
export const CATEGORY_FACILITIES_SERVICES = "facilities-services";
export const CATEGORY_FACILITIES_EQUIPMENT = "facilities-equipment";
export const CATEGORY_FACILITIES_MAINTENANCE = "facilities-maintenance";
export const CATEGORY_MARKETING_SUPPLIES = "marketing-supplies";
export const CATEGORY_MARKETING_SERVICES = "marketing-services";
export const CATEGORY_MARKETING_EQUIPMENT = "marketing-equipment";
export const CATEGORY_MARKETING_MAINTENANCE = "marketing-maintenance";
export const CATEGORY_EVENTS_SUPPLIES = "events-supplies";
export const CATEGORY_EVENTS_SERVICES = "events-services";
export const CATEGORY_EVENTS_EQUIPMENT = "events-equipment";
export const CATEGORY_EVENTS_MAINTENANCE = "events-maintenance";
export const CATEGORY_FLEET_SUPPLIES = "fleet-supplies";
export const CATEGORY_FLEET_SERVICES = "fleet-services";
export const CATEGORY_FLEET_EQUIPMENT = "fleet-equipment";
export const CATEGORY_FLEET_MAINTENANCE = "fleet-maintenance";
export const CATEGORY_TRAINING_SUPPLIES = "training-supplies";
export const CATEGORY_TRAINING_SERVICES = "training-services";
export const CATEGORY_TRAINING_EQUIPMENT = "training-equipment";
export const CATEGORY_TRAINING_MAINTENANCE = "training-maintenance";
export const CATEGORY_LAB_SUPPLIES = "lab-supplies";
export const CATEGORY_LAB_SERVICES = "lab-services";
export const CATEGORY_LAB_EQUIPMENT = "lab-equipment";
export const CATEGORY_LAB_MAINTENANCE = "lab-maintenance";
export const CATEGORY_STUDIO_SUPPLIES = "studio-supplies";
export const CATEGORY_STUDIO_SERVICES = "studio-services";
export const CATEGORY_STUDIO_EQUIPMENT = "studio-equipment";
export const CATEGORY_STUDIO_MAINTENANCE = "studio-maintenance";
export const CATEGORY_WAREHOUSE_SUPPLIES = "warehouse-supplies";
export const CATEGORY_WAREHOUSE_SERVICES = "warehouse-services";
export const CATEGORY_WAREHOUSE_EQUIPMENT = "warehouse-equipment";
export const CATEGORY_WAREHOUSE_MAINTENANCE = "warehouse-maintenance";
export const CATEGORY_RETAIL_SUPPLIES = "retail-supplies";
export const CATEGORY_RETAIL_SERVICES = "retail-services";
export const CATEGORY_RETAIL_EQUIPMENT = "retail-equipment";
export const CATEGORY_RETAIL_MAINTENANCE = "retail-maintenance";

export const LEDGER_ENTRIES: readonly LedgerEntry[] = [
  { id: "T-0001", date: "2025-04-22", category: "retail-services", memo: "restock order", amountCents: 74664 },
  { id: "T-0002", date: "2025-05-22", category: "field-equipment", memo: "bulk order", amountCents: 65869 },
  { id: "T-0003", date: "2025-05-25", category: "facilities-supplies", memo: "contract renewal", amountCents: 65105 },
  { id: "T-0004", date: "2025-02-09", category: "marketing-services", memo: "bulk order", amountCents: 74297 },
  { id: "T-0005", date: "2025-04-28", category: "lab-supplies", memo: "expense report", amountCents: 47470 },
  { id: "T-0006", date: "2025-06-10", category: "marketing-equipment", memo: "bulk order", amountCents: 12819 },
  { id: "T-0007", date: "2025-06-21", category: "warehouse-services", memo: "recurring charge", amountCents: 39490 },
  { id: "T-0008", date: "2025-02-19", category: "field-supplies", memo: "restock order", amountCents: 23849 },
  { id: "T-0009", date: "2025-01-11", category: "studio-equipment", memo: "restock order", amountCents: 59346 },
  { id: "T-0010", date: "2025-04-08", category: "marketing-equipment", memo: "reimbursement", amountCents: 77617 },
  { id: "T-0011", date: "2025-05-12", category: "training-maintenance", memo: "purchase order", amountCents: 55016 },
  { id: "T-0012", date: "2025-01-05", category: "marketing-supplies", memo: "restock order", amountCents: 4308 },
  { id: "T-0013", date: "2025-06-17", category: "warehouse-services", memo: "recurring charge", amountCents: 61876 },
  { id: "T-0014", date: "2025-03-17", category: "events-equipment", memo: "purchase order", amountCents: 65648 },
  { id: "T-0015", date: "2025-05-09", category: "lab-maintenance", memo: "expense report", amountCents: 70683 },
  { id: "T-0016", date: "2025-01-07", category: "office-services", memo: "reimbursement", amountCents: 77026 },
  { id: "T-0017", date: "2025-03-14", category: "lab-maintenance", memo: "service call", amountCents: 82263 },
  { id: "T-0018", date: "2025-05-08", category: "fleet-supplies", memo: "contract renewal", amountCents: 1420 },
  { id: "T-0019", date: "2025-05-22", category: "events-services", memo: "contract renewal", amountCents: 76292 },
  { id: "T-0020", date: "2025-05-03", category: "events-equipment", memo: "net-30 payment", amountCents: 17768 },
  { id: "T-0021", date: "2025-01-11", category: "facilities-maintenance", memo: "restock order", amountCents: 81495 },
  { id: "T-0022", date: "2025-02-08", category: "field-maintenance", memo: "one-off purchase", amountCents: 48874 },
  { id: "T-0023", date: "2025-06-26", category: "retail-maintenance", memo: "bulk order", amountCents: 25949 },
  { id: "T-0024", date: "2025-05-24", category: "field-equipment", memo: "one-off purchase", amountCents: 30006 },
  { id: "T-0025", date: "2025-01-10", category: "field-supplies", memo: "quarterly invoice", amountCents: 37011 },
  { id: "T-0026", date: "2025-02-05", category: "events-equipment", memo: "net-30 payment", amountCents: 43210 },
  { id: "T-0027", date: "2025-04-06", category: "facilities-maintenance", memo: "service call", amountCents: 98788 },
  { id: "T-0028", date: "2025-01-28", category: "lab-equipment", memo: "net-30 payment", amountCents: 96262 },
  { id: "T-0029", date: "2025-05-26", category: "marketing-supplies", memo: "quarterly invoice", amountCents: 6963 },
  { id: "T-0030", date: "2025-03-10", category: "retail-supplies", memo: "contract renewal", amountCents: 97694 },
  { id: "T-0031", date: "2025-02-21", category: "training-supplies", memo: "reimbursement", amountCents: 38258 },
  { id: "T-0032", date: "2025-05-17", category: "fleet-services", memo: "net-30 payment", amountCents: 19587 },
  { id: "T-0033", date: "2025-06-22", category: "office-supplies", memo: "net-30 payment", amountCents: 32645 },
  { id: "T-0034", date: "2025-05-10", category: "retail-maintenance", memo: "one-off purchase", amountCents: 47931 },
  { id: "T-0035", date: "2025-06-27", category: "facilities-equipment", memo: "one-off purchase", amountCents: 4860 },
  { id: "T-0036", date: "2025-06-16", category: "studio-supplies", memo: "contract renewal", amountCents: 26439 },
  { id: "T-0037", date: "2025-01-10", category: "office-maintenance", memo: "one-off purchase", amountCents: 87358 },
  { id: "T-0038", date: "2025-04-14", category: "lab-supplies", memo: "emergency replacement", amountCents: 89550 },
  { id: "T-0039", date: "2025-03-18", category: "field-services", memo: "purchase order", amountCents: 31535 },
  { id: "T-0040", date: "2025-02-27", category: "lab-equipment", memo: "quarterly invoice", amountCents: 51856 },
  { id: "T-0041", date: "2025-05-07", category: "office-maintenance", memo: "bulk order", amountCents: 25499 },
  { id: "T-0042", date: "2025-02-24", category: "fleet-services", memo: "contract renewal", amountCents: 5513 },
  { id: "T-0043", date: "2025-05-08", category: "warehouse-supplies", memo: "one-off purchase", amountCents: 80499 },
  { id: "T-0044", date: "2025-03-23", category: "studio-services", memo: "quarterly invoice", amountCents: 22350 },
  { id: "T-0045", date: "2025-01-07", category: "field-services", memo: "recurring charge", amountCents: 1574 },
  { id: "T-0046", date: "2025-02-27", category: "retail-maintenance", memo: "quarterly invoice", amountCents: 56900 },
  { id: "T-0047", date: "2025-06-11", category: "studio-equipment", memo: "service call", amountCents: 35484 },
  { id: "T-0048", date: "2025-03-02", category: "training-maintenance", memo: "bulk order", amountCents: 56673 },
  { id: "T-0049", date: "2025-05-13", category: "warehouse-services", memo: "reimbursement", amountCents: 26011 },
  { id: "T-0050", date: "2025-03-21", category: "field-maintenance", memo: "purchase order", amountCents: 43648 },
  { id: "T-0051", date: "2025-02-26", category: "studio-services", memo: "quarterly invoice", amountCents: 7382 },
  { id: "T-0052", date: "2025-05-03", category: "facilities-equipment", memo: "service call", amountCents: 97715 },
  { id: "T-0053", date: "2025-04-25", category: "warehouse-maintenance", memo: "recurring charge", amountCents: 67227 },
  { id: "T-0054", date: "2025-05-04", category: "warehouse-services", memo: "recurring charge", amountCents: 5875 },
  { id: "T-0055", date: "2025-04-21", category: "marketing-supplies", memo: "service call", amountCents: 57882 },
  { id: "T-0056", date: "2025-06-15", category: "retail-equipment", memo: "expense report", amountCents: 22938 },
  { id: "T-0057", date: "2025-04-14", category: "office-maintenance", memo: "service call", amountCents: 46461 },
  { id: "T-0058", date: "2025-03-09", category: "studio-equipment", memo: "restock order", amountCents: 19828 },
  { id: "T-0059", date: "2025-01-27", category: "office-services", memo: "reimbursement", amountCents: 83306 },
  { id: "T-0060", date: "2025-01-27", category: "facilities-equipment", memo: "bulk order", amountCents: 78669 },
  { id: "T-0061", date: "2025-04-18", category: "office-services", memo: "reimbursement", amountCents: 59348 },
  { id: "T-0062", date: "2025-04-18", category: "warehouse-services", memo: "reimbursement", amountCents: 12189 },
  { id: "T-0063", date: "2025-02-27", category: "events-services", memo: "quarterly invoice", amountCents: 77430 },
  { id: "T-0064", date: "2025-05-18", category: "training-maintenance", memo: "contract renewal", amountCents: 17042 },
  { id: "T-0065", date: "2025-02-07", category: "retail-equipment", memo: "recurring charge", amountCents: 32697 },
  { id: "T-0066", date: "2025-01-08", category: "fleet-supplies", memo: "purchase order", amountCents: 73121 },
  { id: "T-0067", date: "2025-05-13", category: "fleet-maintenance", memo: "net-30 payment", amountCents: 11752 },
  { id: "T-0068", date: "2025-01-11", category: "studio-supplies", memo: "purchase order", amountCents: 77977 },
  { id: "T-0069", date: "2025-01-18", category: "warehouse-equipment", memo: "emergency replacement", amountCents: 7685 },
  { id: "T-0070", date: "2025-01-01", category: "office-services", memo: "net-30 payment", amountCents: 84971 },
  { id: "T-0071", date: "2025-04-22", category: "lab-services", memo: "net-30 payment", amountCents: 70496 },
  { id: "T-0072", date: "2025-06-24", category: "field-maintenance", memo: "service call", amountCents: 36154 },
  { id: "T-0073", date: "2025-03-17", category: "warehouse-maintenance", memo: "net-30 payment", amountCents: 58162 },
  { id: "T-0074", date: "2025-04-28", category: "marketing-supplies", memo: "emergency replacement", amountCents: 43520 },
  { id: "T-0075", date: "2025-02-07", category: "office-equipment", memo: "net-30 payment", amountCents: 89169 },
  { id: "T-0076", date: "2025-05-14", category: "lab-equipment", memo: "recurring charge", amountCents: 34005 },
  { id: "T-0077", date: "2025-04-06", category: "marketing-equipment", memo: "bulk order", amountCents: 84420 },
  { id: "T-0078", date: "2025-01-13", category: "marketing-maintenance", memo: "restock order", amountCents: 76028 },
  { id: "T-0079", date: "2025-06-21", category: "lab-maintenance", memo: "purchase order", amountCents: 8990 },
  { id: "T-0080", date: "2025-06-21", category: "events-equipment", memo: "reimbursement", amountCents: 65540 },
  { id: "T-0081", date: "2025-02-01", category: "training-services", memo: "service call", amountCents: 65048 },
  { id: "T-0082", date: "2025-05-14", category: "vendor-services", memo: "recurring charge", amountCents: 42051 },
  { id: "T-0083", date: "2025-06-17", category: "warehouse-equipment", memo: "net-30 payment", amountCents: 53057 },
  { id: "T-0084", date: "2025-04-10", category: "office-maintenance", memo: "emergency replacement", amountCents: 63089 },
  { id: "T-0085", date: "2025-02-01", category: "training-services", memo: "emergency replacement", amountCents: 13765 },
  { id: "T-0086", date: "2025-01-14", category: "facilities-maintenance", memo: "expense report", amountCents: 78323 },
  { id: "T-0087", date: "2025-04-10", category: "retail-supplies", memo: "quarterly invoice", amountCents: 34026 },
  { id: "T-0088", date: "2025-05-14", category: "training-supplies", memo: "recurring charge", amountCents: 12579 },
  { id: "T-0089", date: "2025-04-08", category: "studio-services", memo: "restock order", amountCents: 9593 },
  { id: "T-0090", date: "2025-06-14", category: "warehouse-equipment", memo: "purchase order", amountCents: 44465 },
  { id: "T-0091", date: "2025-01-12", category: "vendor-maintenance", memo: "restock order", amountCents: 49026 },
  { id: "T-0092", date: "2025-04-11", category: "field-services", memo: "net-30 payment", amountCents: 83552 },
  { id: "T-0093", date: "2025-03-07", category: "fleet-maintenance", memo: "service call", amountCents: 73912 },
  { id: "T-0094", date: "2025-01-28", category: "facilities-maintenance", memo: "expense report", amountCents: 38539 },
  { id: "T-0095", date: "2025-01-21", category: "retail-maintenance", memo: "purchase order", amountCents: 7167 },
  { id: "T-0096", date: "2025-05-26", category: "events-equipment", memo: "service call", amountCents: 5698 },
  { id: "T-0097", date: "2025-05-28", category: "warehouse-supplies", memo: "net-30 payment", amountCents: 29404 },
  { id: "T-0098", date: "2025-02-27", category: "field-services", memo: "net-30 payment", amountCents: 69081 },
  { id: "T-0099", date: "2025-03-05", category: "lab-maintenance", memo: "one-off purchase", amountCents: 64871 },
  { id: "T-0100", date: "2025-03-26", category: "vendor-equipment", memo: "expense report", amountCents: 94520 },
  { id: "T-0101", date: "2025-04-24", category: "studio-equipment", memo: "net-30 payment", amountCents: 46212 },
  { id: "T-0102", date: "2025-01-16", category: "studio-services", memo: "one-off purchase", amountCents: 25632 },
  { id: "T-0103", date: "2025-03-22", category: "fleet-maintenance", memo: "emergency replacement", amountCents: 44821 },
  { id: "T-0104", date: "2025-03-10", category: "lab-maintenance", memo: "net-30 payment", amountCents: 35911 },
  { id: "T-0105", date: "2025-02-20", category: "lab-services", memo: "restock order", amountCents: 63223 },
  { id: "T-0106", date: "2025-06-08", category: "warehouse-supplies", memo: "reimbursement", amountCents: 74795 },
  { id: "T-0107", date: "2025-04-08", category: "warehouse-equipment", memo: "purchase order", amountCents: 64563 },
  { id: "T-0108", date: "2025-02-25", category: "studio-services", memo: "expense report", amountCents: 76041 },
  { id: "T-0109", date: "2025-05-17", category: "lab-maintenance", memo: "net-30 payment", amountCents: 32598 },
  { id: "T-0110", date: "2025-06-17", category: "field-maintenance", memo: "emergency replacement", amountCents: 62724 },
  { id: "T-0111", date: "2025-04-21", category: "lab-supplies", memo: "purchase order", amountCents: 2108 },
  { id: "T-0112", date: "2025-06-25", category: "vendor-maintenance", memo: "expense report", amountCents: 6700 },
  { id: "T-0113", date: "2025-04-16", category: "retail-maintenance", memo: "bulk order", amountCents: 91566 },
  { id: "T-0114", date: "2025-05-06", category: "facilities-supplies", memo: "emergency replacement", amountCents: 56306 },
  { id: "T-0115", date: "2025-04-15", category: "fleet-supplies", memo: "recurring charge", amountCents: 2843 },
  { id: "T-0116", date: "2025-05-13", category: "retail-maintenance", memo: "reimbursement", amountCents: 11992 },
  { id: "T-0117", date: "2025-04-28", category: "field-services", memo: "contract renewal", amountCents: 66763 },
  { id: "T-0118", date: "2025-01-02", category: "vendor-equipment", memo: "purchase order", amountCents: 59576 },
  { id: "T-0119", date: "2025-03-15", category: "vendor-supplies", memo: "restock order", amountCents: 10217 },
  { id: "T-0120", date: "2025-06-14", category: "retail-maintenance", memo: "contract renewal", amountCents: 74808 },
  { id: "T-0121", date: "2025-04-18", category: "office-equipment", memo: "recurring charge", amountCents: 24827 },
  { id: "T-0122", date: "2025-02-09", category: "facilities-maintenance", memo: "expense report", amountCents: 7389 },
  { id: "T-0123", date: "2025-03-28", category: "facilities-maintenance", memo: "expense report", amountCents: 49993 },
  { id: "T-0124", date: "2025-02-28", category: "marketing-supplies", memo: "quarterly invoice", amountCents: 53780 },
  { id: "T-0125", date: "2025-01-26", category: "warehouse-maintenance", memo: "net-30 payment", amountCents: 42328 },
  { id: "T-0126", date: "2025-01-05", category: "training-equipment", memo: "net-30 payment", amountCents: 82197 },
  { id: "T-0127", date: "2025-01-24", category: "events-equipment", memo: "bulk order", amountCents: 63577 },
  { id: "T-0128", date: "2025-06-09", category: "marketing-supplies", memo: "restock order", amountCents: 39403 },
  { id: "T-0129", date: "2025-02-24", category: "retail-equipment", memo: "net-30 payment", amountCents: 30830 },
  { id: "T-0130", date: "2025-04-14", category: "facilities-equipment", memo: "contract renewal", amountCents: 34199 },
  { id: "T-0131", date: "2025-05-14", category: "fleet-equipment", memo: "service call", amountCents: 3657 },
  { id: "T-0132", date: "2025-02-16", category: "office-maintenance", memo: "quarterly invoice", amountCents: 17700 },
  { id: "T-0133", date: "2025-06-03", category: "field-equipment", memo: "restock order", amountCents: 40198 },
  { id: "T-0134", date: "2025-02-21", category: "retail-supplies", memo: "service call", amountCents: 3777 },
  { id: "T-0135", date: "2025-04-15", category: "office-supplies", memo: "recurring charge", amountCents: 8340 },
  { id: "T-0136", date: "2025-03-28", category: "studio-services", memo: "contract renewal", amountCents: 9187 },
  { id: "T-0137", date: "2025-03-14", category: "training-supplies", memo: "reimbursement", amountCents: 83952 },
  { id: "T-0138", date: "2025-02-14", category: "office-services", memo: "quarterly invoice", amountCents: 21917 },
  { id: "T-0139", date: "2025-04-28", category: "lab-supplies", memo: "service call", amountCents: 2851 },
  { id: "T-0140", date: "2025-01-25", category: "warehouse-equipment", memo: "restock order", amountCents: 97223 },
  { id: "T-0141", date: "2025-06-22", category: "lab-equipment", memo: "quarterly invoice", amountCents: 80807 },
  { id: "T-0142", date: "2025-03-27", category: "training-maintenance", memo: "bulk order", amountCents: 36715 },
  { id: "T-0143", date: "2025-03-28", category: "vendor-maintenance", memo: "net-30 payment", amountCents: 83929 },
  { id: "T-0144", date: "2025-04-26", category: "facilities-services", memo: "reimbursement", amountCents: 89534 },
  { id: "T-0145", date: "2025-03-26", category: "training-equipment", memo: "net-30 payment", amountCents: 42023 },
  { id: "T-0146", date: "2025-02-10", category: "vendor-services", memo: "recurring charge", amountCents: 83586 },
  { id: "T-0147", date: "2025-05-14", category: "vendor-supplies", memo: "service call", amountCents: 88640 },
  { id: "T-0148", date: "2025-04-28", category: "facilities-services", memo: "purchase order", amountCents: 93035 },
  { id: "T-0149", date: "2025-03-24", category: "marketing-services", memo: "emergency replacement", amountCents: 64169 },
  { id: "T-0150", date: "2025-03-02", category: "vendor-services", memo: "service call", amountCents: 28270 },
  { id: "T-0151", date: "2025-01-01", category: "field-supplies", memo: "quarterly invoice", amountCents: 53587 },
  { id: "T-0152", date: "2025-02-19", category: "office-maintenance", memo: "bulk order", amountCents: 33748 },
  { id: "T-0153", date: "2025-03-07", category: "training-supplies", memo: "reimbursement", amountCents: 3351 },
  { id: "T-0154", date: "2025-02-23", category: "fleet-supplies", memo: "service call", amountCents: 24678 },
  { id: "T-0155", date: "2025-03-25", category: "vendor-equipment", memo: "contract renewal", amountCents: 66720 },
  { id: "T-0156", date: "2025-02-02", category: "events-equipment", memo: "quarterly invoice", amountCents: 85096 },
  { id: "T-0157", date: "2025-01-09", category: "warehouse-services", memo: "quarterly invoice", amountCents: 85300 },
  { id: "T-0158", date: "2025-06-15", category: "vendor-equipment", memo: "bulk order", amountCents: 64423 },
  { id: "T-0159", date: "2025-04-25", category: "studio-maintenance", memo: "contract renewal", amountCents: 26566 },
  { id: "T-0160", date: "2025-02-14", category: "studio-services", memo: "recurring charge", amountCents: 32691 },
  { id: "T-0161", date: "2025-01-25", category: "lab-maintenance", memo: "expense report", amountCents: 61663 },
  { id: "T-0162", date: "2025-05-04", category: "training-equipment", memo: "restock order", amountCents: 47539 },
  { id: "T-0163", date: "2025-01-22", category: "retail-maintenance", memo: "purchase order", amountCents: 80122 },
  { id: "T-0164", date: "2025-06-04", category: "studio-maintenance", memo: "contract renewal", amountCents: 49396 },
  { id: "T-0165", date: "2025-01-10", category: "facilities-maintenance", memo: "reimbursement", amountCents: 604 },
  { id: "T-0166", date: "2025-03-04", category: "warehouse-services", memo: "emergency replacement", amountCents: 19339 },
  { id: "T-0167", date: "2025-02-23", category: "office-services", memo: "bulk order", amountCents: 37241 },
  { id: "T-0168", date: "2025-01-21", category: "training-supplies", memo: "service call", amountCents: 13844 },
  { id: "T-0169", date: "2025-01-26", category: "field-maintenance", memo: "reimbursement", amountCents: 55474 },
  { id: "T-0170", date: "2025-01-22", category: "training-maintenance", memo: "quarterly invoice", amountCents: 53694 },
  { id: "T-0171", date: "2025-05-15", category: "events-supplies", memo: "quarterly invoice", amountCents: 53347 },
  { id: "T-0172", date: "2025-02-15", category: "lab-maintenance", memo: "net-30 payment", amountCents: 76852 },
  { id: "T-0173", date: "2025-01-20", category: "retail-maintenance", memo: "service call", amountCents: 52042 },
  { id: "T-0174", date: "2025-04-11", category: "fleet-services", memo: "quarterly invoice", amountCents: 30649 },
  { id: "T-0175", date: "2025-04-10", category: "lab-services", memo: "contract renewal", amountCents: 77774 },
  { id: "T-0176", date: "2025-02-27", category: "field-equipment", memo: "recurring charge", amountCents: 35513 },
  { id: "T-0177", date: "2025-01-05", category: "retail-services", memo: "contract renewal", amountCents: 86703 },
  { id: "T-0178", date: "2025-02-28", category: "events-supplies", memo: "purchase order", amountCents: 63405 },
  { id: "T-0179", date: "2025-06-26", category: "training-supplies", memo: "net-30 payment", amountCents: 98252 },
  { id: "T-0180", date: "2025-03-15", category: "lab-services", memo: "bulk order", amountCents: 82324 },
  { id: "T-0181", date: "2025-02-02", category: "office-services", memo: "quarterly invoice", amountCents: 8752 },
  { id: "T-0182", date: "2025-05-18", category: "office-services", memo: "one-off purchase", amountCents: 66383 },
  { id: "T-0183", date: "2025-01-06", category: "events-services", memo: "purchase order", amountCents: 77987 },
  { id: "T-0184", date: "2025-04-07", category: "studio-services", memo: "emergency replacement", amountCents: 56700 },
  { id: "T-0185", date: "2025-04-25", category: "fleet-maintenance", memo: "recurring charge", amountCents: 53573 },
  { id: "T-0186", date: "2025-03-10", category: "studio-supplies", memo: "service call", amountCents: 8243 },
  { id: "T-0187", date: "2025-04-19", category: "training-services", memo: "one-off purchase", amountCents: 88594 },
  { id: "T-0188", date: "2025-02-14", category: "vendor-services", memo: "reimbursement", amountCents: 32687 },
  { id: "T-0189", date: "2025-04-11", category: "marketing-equipment", memo: "contract renewal", amountCents: 63920 },
  { id: "T-0190", date: "2025-04-04", category: "vendor-maintenance", memo: "one-off purchase", amountCents: 32474 },
  { id: "T-0191", date: "2025-03-04", category: "lab-equipment", memo: "reimbursement", amountCents: 3615 },
  { id: "T-0192", date: "2025-05-05", category: "lab-services", memo: "net-30 payment", amountCents: 21896 },
  { id: "T-0193", date: "2025-05-16", category: "marketing-services", memo: "purchase order", amountCents: 73359 },
  { id: "T-0194", date: "2025-01-04", category: "events-maintenance", memo: "contract renewal", amountCents: 67794 },
  { id: "T-0195", date: "2025-02-04", category: "studio-services", memo: "recurring charge", amountCents: 19422 },
  { id: "T-0196", date: "2025-04-22", category: "vendor-supplies", memo: "emergency replacement", amountCents: 58417 },
  { id: "T-0197", date: "2025-03-22", category: "field-equipment", memo: "purchase order", amountCents: 54978 },
  { id: "T-0198", date: "2025-02-06", category: "facilities-services", memo: "expense report", amountCents: 35308 },
  { id: "T-0199", date: "2025-05-03", category: "vendor-maintenance", memo: "reimbursement", amountCents: 56561 },
  { id: "T-0200", date: "2025-06-01", category: "vendor-maintenance", memo: "recurring charge", amountCents: 89307 },
  { id: "T-0201", date: "2025-02-22", category: "retail-services", memo: "emergency replacement", amountCents: 5236 },
  { id: "T-0202", date: "2025-05-05", category: "events-maintenance", memo: "reimbursement", amountCents: 77679 },
  { id: "T-0203", date: "2025-04-17", category: "studio-maintenance", memo: "reimbursement", amountCents: 39725 },
  { id: "T-0204", date: "2025-05-10", category: "warehouse-services", memo: "restock order", amountCents: 11750 },
  { id: "T-0205", date: "2025-06-17", category: "lab-maintenance", memo: "bulk order", amountCents: 78936 },
  { id: "T-0206", date: "2025-02-20", category: "training-supplies", memo: "recurring charge", amountCents: 1179 },
  { id: "T-0207", date: "2025-03-14", category: "fleet-maintenance", memo: "contract renewal", amountCents: 53728 },
  { id: "T-0208", date: "2025-02-27", category: "marketing-equipment", memo: "bulk order", amountCents: 35586 },
  { id: "T-0209", date: "2025-06-21", category: "marketing-equipment", memo: "quarterly invoice", amountCents: 37896 },
  { id: "T-0210", date: "2025-03-16", category: "marketing-supplies", memo: "bulk order", amountCents: 21826 },
  { id: "T-0211", date: "2025-05-27", category: "facilities-supplies", memo: "purchase order", amountCents: 30241 },
  { id: "T-0212", date: "2025-06-06", category: "studio-services", memo: "restock order", amountCents: 98229 },
  { id: "T-0213", date: "2025-02-20", category: "events-supplies", memo: "recurring charge", amountCents: 79043 },
  { id: "T-0214", date: "2025-02-17", category: "vendor-supplies", memo: "net-30 payment", amountCents: 92509 },
  { id: "T-0215", date: "2025-03-15", category: "lab-supplies", memo: "one-off purchase", amountCents: 54393 },
  { id: "T-0216", date: "2025-03-10", category: "warehouse-services", memo: "recurring charge", amountCents: 87690 },
  { id: "T-0217", date: "2025-05-25", category: "vendor-services", memo: "service call", amountCents: 85123 },
  { id: "T-0218", date: "2025-03-11", category: "retail-maintenance", memo: "contract renewal", amountCents: 47924 },
  { id: "T-0219", date: "2025-06-16", category: "events-maintenance", memo: "bulk order", amountCents: 18454 },
  { id: "T-0220", date: "2025-06-19", category: "office-equipment", memo: "net-30 payment", amountCents: 30960 },
  { id: "T-0221", date: "2025-04-05", category: "events-supplies", memo: "purchase order", amountCents: 73842 },
  { id: "T-0222", date: "2025-05-11", category: "vendor-maintenance", memo: "one-off purchase", amountCents: 65343 },
  { id: "T-0223", date: "2025-06-18", category: "marketing-equipment", memo: "net-30 payment", amountCents: 42824 },
  { id: "T-0224", date: "2025-04-13", category: "facilities-services", memo: "purchase order", amountCents: 5413 },
  { id: "T-0225", date: "2025-06-24", category: "office-maintenance", memo: "purchase order", amountCents: 16181 },
  { id: "T-0226", date: "2025-03-20", category: "marketing-supplies", memo: "recurring charge", amountCents: 35926 },
  { id: "T-0227", date: "2025-06-04", category: "warehouse-equipment", memo: "expense report", amountCents: 27820 },
  { id: "T-0228", date: "2025-02-13", category: "warehouse-services", memo: "emergency replacement", amountCents: 68190 },
  { id: "T-0229", date: "2025-04-08", category: "retail-supplies", memo: "emergency replacement", amountCents: 68040 },
  { id: "T-0230", date: "2025-01-23", category: "retail-equipment", memo: "quarterly invoice", amountCents: 38312 },
  { id: "T-0231", date: "2025-05-05", category: "fleet-services", memo: "net-30 payment", amountCents: 13248 },
  { id: "T-0232", date: "2025-03-25", category: "training-supplies", memo: "purchase order", amountCents: 62862 },
  { id: "T-0233", date: "2025-02-23", category: "fleet-maintenance", memo: "quarterly invoice", amountCents: 4579 },
  { id: "T-0234", date: "2025-06-04", category: "lab-services", memo: "restock order", amountCents: 29994 },
  { id: "T-0235", date: "2025-06-20", category: "marketing-equipment", memo: "quarterly invoice", amountCents: 2933 },
  { id: "T-0236", date: "2025-02-20", category: "vendor-maintenance", memo: "expense report", amountCents: 85092 },
  { id: "T-0237", date: "2025-01-05", category: "retail-services", memo: "recurring charge", amountCents: 20810 },
  { id: "T-0238", date: "2025-04-10", category: "fleet-services", memo: "expense report", amountCents: 41637 },
  { id: "T-0239", date: "2025-03-06", category: "vendor-maintenance", memo: "net-30 payment", amountCents: 81934 },
  { id: "T-0240", date: "2025-05-07", category: "warehouse-services", memo: "contract renewal", amountCents: 8144 },
  { id: "T-0241", date: "2025-03-07", category: "retail-equipment", memo: "recurring charge", amountCents: 64707 },
  { id: "T-0242", date: "2025-03-13", category: "training-supplies", memo: "expense report", amountCents: 48440 },
  { id: "T-0243", date: "2025-02-28", category: "vendor-equipment", memo: "expense report", amountCents: 42825 },
  { id: "T-0244", date: "2025-01-09", category: "vendor-maintenance", memo: "recurring charge", amountCents: 13892 },
  { id: "T-0245", date: "2025-01-19", category: "studio-services", memo: "expense report", amountCents: 4224 },
  { id: "T-0246", date: "2025-06-20", category: "vendor-equipment", memo: "emergency replacement", amountCents: 86057 },
  { id: "T-0247", date: "2025-02-09", category: "marketing-supplies", memo: "recurring charge", amountCents: 43865 },
  { id: "T-0248", date: "2025-01-19", category: "vendor-equipment", memo: "reimbursement", amountCents: 61772 },
  { id: "T-0249", date: "2025-04-11", category: "office-services", memo: "purchase order", amountCents: 48970 },
  { id: "T-0250", date: "2025-04-20", category: "events-services", memo: "quarterly invoice", amountCents: 7364 },
  { id: "T-0251", date: "2025-02-15", category: "lab-supplies", memo: "service call", amountCents: 96163 },
  { id: "T-0252", date: "2025-04-14", category: "lab-equipment", memo: "recurring charge", amountCents: 38239 },
  { id: "T-0253", date: "2025-01-09", category: "vendor-equipment", memo: "expense report", amountCents: 23183 },
  { id: "T-0254", date: "2025-01-22", category: "studio-equipment", memo: "purchase order", amountCents: 38279 },
  { id: "T-0255", date: "2025-05-07", category: "retail-services", memo: "emergency replacement", amountCents: 48995 },
  { id: "T-0256", date: "2025-05-09", category: "studio-supplies", memo: "purchase order", amountCents: 39761 },
  { id: "T-0257", date: "2025-01-10", category: "field-supplies", memo: "contract renewal", amountCents: 36620 },
  { id: "T-0258", date: "2025-04-28", category: "marketing-services", memo: "service call", amountCents: 83761 },
  { id: "T-0259", date: "2025-01-02", category: "events-services", memo: "contract renewal", amountCents: 91456 },
  { id: "T-0260", date: "2025-01-01", category: "studio-maintenance", memo: "bulk order", amountCents: 24767 },
  { id: "T-0261", date: "2025-02-19", category: "office-supplies", memo: "contract renewal", amountCents: 85819 },
  { id: "T-0262", date: "2025-06-22", category: "facilities-supplies", memo: "contract renewal", amountCents: 6224 },
  { id: "T-0263", date: "2025-06-10", category: "lab-supplies", memo: "emergency replacement", amountCents: 50078 },
  { id: "T-0264", date: "2025-05-08", category: "fleet-equipment", memo: "purchase order", amountCents: 15171 },
  { id: "T-0265", date: "2025-02-10", category: "studio-equipment", memo: "quarterly invoice", amountCents: 92071 },
  { id: "T-0266", date: "2025-05-15", category: "office-services", memo: "recurring charge", amountCents: 46645 },
  { id: "T-0267", date: "2025-01-28", category: "retail-services", memo: "service call", amountCents: 57707 },
  { id: "T-0268", date: "2025-06-22", category: "field-supplies", memo: "bulk order", amountCents: 4895 },
  { id: "T-0269", date: "2025-05-11", category: "events-supplies", memo: "quarterly invoice", amountCents: 98383 },
  { id: "T-0270", date: "2025-04-01", category: "vendor-maintenance", memo: "recurring charge", amountCents: 70702 },
  { id: "T-0271", date: "2025-02-13", category: "events-equipment", memo: "net-30 payment", amountCents: 82065 },
  { id: "T-0272", date: "2025-02-03", category: "office-maintenance", memo: "contract renewal", amountCents: 43022 },
  { id: "T-0273", date: "2025-06-15", category: "warehouse-services", memo: "net-30 payment", amountCents: 60096 },
  { id: "T-0274", date: "2025-05-19", category: "warehouse-services", memo: "expense report", amountCents: 78457 },
  { id: "T-0275", date: "2025-05-13", category: "facilities-maintenance", memo: "bulk order", amountCents: 73354 },
  { id: "T-0276", date: "2025-04-20", category: "events-services", memo: "reimbursement", amountCents: 27451 },
  { id: "T-0277", date: "2025-05-10", category: "facilities-supplies", memo: "quarterly invoice", amountCents: 35357 },
  { id: "T-0278", date: "2025-05-17", category: "retail-services", memo: "net-30 payment", amountCents: 30382 },
  { id: "T-0279", date: "2025-04-16", category: "fleet-maintenance", memo: "recurring charge", amountCents: 56662 },
  { id: "T-0280", date: "2025-03-11", category: "facilities-services", memo: "restock order", amountCents: 64272 },
  { id: "T-0281", date: "2025-03-26", category: "fleet-supplies", memo: "service call", amountCents: 72008 },
  { id: "T-0282", date: "2025-02-06", category: "lab-services", memo: "one-off purchase", amountCents: 67224 },
  { id: "T-0283", date: "2025-01-28", category: "events-services", memo: "bulk order", amountCents: 33630 },
  { id: "T-0284", date: "2025-04-19", category: "training-maintenance", memo: "bulk order", amountCents: 57214 },
  { id: "T-0285", date: "2025-06-19", category: "warehouse-maintenance", memo: "bulk order", amountCents: 20991 },
  { id: "T-0286", date: "2025-05-11", category: "lab-equipment", memo: "reimbursement", amountCents: 5850 },
  { id: "T-0287", date: "2025-04-28", category: "marketing-maintenance", memo: "purchase order", amountCents: 73062 },
  { id: "T-0288", date: "2025-05-15", category: "facilities-supplies", memo: "purchase order", amountCents: 74528 },
  { id: "T-0289", date: "2025-04-13", category: "lab-supplies", memo: "reimbursement", amountCents: 35719 },
  { id: "T-0290", date: "2025-06-03", category: "marketing-equipment", memo: "reimbursement", amountCents: 60612 },
  { id: "T-0291", date: "2025-02-12", category: "studio-services", memo: "expense report", amountCents: 27700 },
  { id: "T-0292", date: "2025-01-23", category: "warehouse-equipment", memo: "recurring charge", amountCents: 90679 },
  { id: "T-0293", date: "2025-02-03", category: "facilities-services", memo: "bulk order", amountCents: 30446 },
  { id: "T-0294", date: "2025-06-21", category: "lab-services", memo: "recurring charge", amountCents: 75065 },
  { id: "T-0295", date: "2025-06-28", category: "warehouse-maintenance", memo: "purchase order", amountCents: 24390 },
  { id: "T-0296", date: "2025-02-04", category: "office-supplies", memo: "service call", amountCents: 79099 },
  { id: "T-0297", date: "2025-01-24", category: "marketing-equipment", memo: "expense report", amountCents: 46679 },
  { id: "T-0298", date: "2025-03-13", category: "events-equipment", memo: "one-off purchase", amountCents: 6419 },
  { id: "T-0299", date: "2025-06-20", category: "training-equipment", memo: "restock order", amountCents: 83895 },
  { id: "T-0300", date: "2025-02-18", category: "retail-supplies", memo: "net-30 payment", amountCents: 8173 },
  { id: "T-0301", date: "2025-02-28", category: "facilities-services", memo: "bulk order", amountCents: 26320 },
  { id: "T-0302", date: "2025-02-16", category: "events-supplies", memo: "service call", amountCents: 96004 },
  { id: "T-0303", date: "2025-03-14", category: "field-supplies", memo: "service call", amountCents: 94169 },
  { id: "T-0304", date: "2025-04-01", category: "fleet-services", memo: "bulk order", amountCents: 68005 },
  { id: "T-0305", date: "2025-04-11", category: "retail-maintenance", memo: "recurring charge", amountCents: 8063 },
  { id: "T-0306", date: "2025-01-20", category: "retail-supplies", memo: "restock order", amountCents: 65280 },
  { id: "T-0307", date: "2025-01-23", category: "events-services", memo: "one-off purchase", amountCents: 18970 },
  { id: "T-0308", date: "2025-04-11", category: "field-maintenance", memo: "quarterly invoice", amountCents: 98024 },
  { id: "T-0309", date: "2025-03-03", category: "warehouse-maintenance", memo: "emergency replacement", amountCents: 39831 },
  { id: "T-0310", date: "2025-05-07", category: "retail-maintenance", memo: "recurring charge", amountCents: 48754 },
  { id: "T-0311", date: "2025-02-04", category: "lab-maintenance", memo: "emergency replacement", amountCents: 9412 },
  { id: "T-0312", date: "2025-04-25", category: "office-services", memo: "expense report", amountCents: 67743 },
  { id: "T-0313", date: "2025-06-17", category: "fleet-supplies", memo: "reimbursement", amountCents: 81552 },
  { id: "T-0314", date: "2025-05-19", category: "office-maintenance", memo: "quarterly invoice", amountCents: 718 },
  { id: "T-0315", date: "2025-06-27", category: "training-services", memo: "bulk order", amountCents: 10322 },
  { id: "T-0316", date: "2025-02-23", category: "office-equipment", memo: "net-30 payment", amountCents: 1518 },
  { id: "T-0317", date: "2025-02-05", category: "marketing-equipment", memo: "emergency replacement", amountCents: 11943 },
  { id: "T-0318", date: "2025-04-22", category: "lab-maintenance", memo: "contract renewal", amountCents: 45264 },
  { id: "T-0319", date: "2025-06-03", category: "studio-equipment", memo: "expense report", amountCents: 79881 },
  { id: "T-0320", date: "2025-05-27", category: "retail-maintenance", memo: "one-off purchase", amountCents: 60148 },
  { id: "T-0321", date: "2025-05-06", category: "lab-equipment", memo: "quarterly invoice", amountCents: 28700 },
  { id: "T-0322", date: "2025-03-09", category: "facilities-services", memo: "purchase order", amountCents: 49290 },
  { id: "T-0323", date: "2025-03-14", category: "marketing-maintenance", memo: "quarterly invoice", amountCents: 83361 },
  { id: "T-0324", date: "2025-06-28", category: "facilities-services", memo: "quarterly invoice", amountCents: 13258 },
  { id: "T-0325", date: "2025-04-23", category: "studio-services", memo: "bulk order", amountCents: 17339 },
  { id: "T-0326", date: "2025-03-19", category: "office-supplies", memo: "one-off purchase", amountCents: 53989 },
  { id: "T-0327", date: "2025-01-20", category: "warehouse-supplies", memo: "contract renewal", amountCents: 44423 },
  { id: "T-0328", date: "2025-02-27", category: "events-equipment", memo: "one-off purchase", amountCents: 63823 },
  { id: "T-0329", date: "2025-05-21", category: "events-maintenance", memo: "bulk order", amountCents: 33175 },
  { id: "T-0330", date: "2025-04-16", category: "training-maintenance", memo: "expense report", amountCents: 6531 },
  { id: "T-0331", date: "2025-05-06", category: "fleet-equipment", memo: "service call", amountCents: 60957 },
  { id: "T-0332", date: "2025-05-06", category: "field-maintenance", memo: "expense report", amountCents: 58610 },
  { id: "T-0333", date: "2025-02-17", category: "field-supplies", memo: "bulk order", amountCents: 35762 },
  { id: "T-0334", date: "2025-03-16", category: "vendor-supplies", memo: "net-30 payment", amountCents: 36206 },
  { id: "T-0335", date: "2025-01-07", category: "vendor-services", memo: "restock order", amountCents: 5682 },
  { id: "T-0336", date: "2025-03-22", category: "office-supplies", memo: "restock order", amountCents: 37229 },
  { id: "T-0337", date: "2025-03-28", category: "studio-services", memo: "bulk order", amountCents: 34277 },
  { id: "T-0338", date: "2025-02-09", category: "lab-maintenance", memo: "expense report", amountCents: 78337 },
  { id: "T-0339", date: "2025-05-01", category: "lab-equipment", memo: "service call", amountCents: 20541 },
  { id: "T-0340", date: "2025-05-26", category: "vendor-services", memo: "emergency replacement", amountCents: 28715 },
  { id: "T-0341", date: "2025-02-20", category: "lab-services", memo: "service call", amountCents: 50978 },
  { id: "T-0342", date: "2025-06-21", category: "training-services", memo: "emergency replacement", amountCents: 41858 },
  { id: "T-0343", date: "2025-02-05", category: "field-equipment", memo: "expense report", amountCents: 55720 },
  { id: "T-0344", date: "2025-01-08", category: "fleet-maintenance", memo: "quarterly invoice", amountCents: 78984 },
  { id: "T-0345", date: "2025-01-06", category: "studio-supplies", memo: "bulk order", amountCents: 8136 },
  { id: "T-0346", date: "2025-05-15", category: "lab-equipment", memo: "reimbursement", amountCents: 11574 },
  { id: "T-0347", date: "2025-01-15", category: "vendor-maintenance", memo: "restock order", amountCents: 68814 },
  { id: "T-0348", date: "2025-02-16", category: "warehouse-maintenance", memo: "expense report", amountCents: 2892 },
  { id: "T-0349", date: "2025-03-02", category: "lab-equipment", memo: "one-off purchase", amountCents: 46725 },
  { id: "T-0350", date: "2025-05-13", category: "office-maintenance", memo: "contract renewal", amountCents: 49452 },
  { id: "T-0351", date: "2025-03-14", category: "marketing-supplies", memo: "service call", amountCents: 67377 },
  { id: "T-0352", date: "2025-05-09", category: "studio-maintenance", memo: "service call", amountCents: 12689 },
  { id: "T-0353", date: "2025-02-09", category: "retail-equipment", memo: "reimbursement", amountCents: 98794 },
  { id: "T-0354", date: "2025-06-06", category: "facilities-services", memo: "service call", amountCents: 6974 },
  { id: "T-0355", date: "2025-02-18", category: "field-supplies", memo: "quarterly invoice", amountCents: 67063 },
  { id: "T-0356", date: "2025-04-26", category: "studio-services", memo: "bulk order", amountCents: 98113 },
  { id: "T-0357", date: "2025-05-07", category: "studio-equipment", memo: "contract renewal", amountCents: 92230 },
  { id: "T-0358", date: "2025-05-07", category: "fleet-services", memo: "service call", amountCents: 45232 },
  { id: "T-0359", date: "2025-01-10", category: "field-supplies", memo: "quarterly invoice", amountCents: 97013 },
  { id: "T-0360", date: "2025-04-21", category: "facilities-equipment", memo: "contract renewal", amountCents: 77341 },
  { id: "T-0361", date: "2025-04-02", category: "marketing-supplies", memo: "recurring charge", amountCents: 61801 },
  { id: "T-0362", date: "2025-06-05", category: "field-equipment", memo: "bulk order", amountCents: 2490 },
  { id: "T-0363", date: "2025-02-23", category: "training-maintenance", memo: "bulk order", amountCents: 32314 },
  { id: "T-0364", date: "2025-05-08", category: "office-services", memo: "net-30 payment", amountCents: 4943 },
  { id: "T-0365", date: "2025-03-03", category: "marketing-supplies", memo: "recurring charge", amountCents: 29503 },
  { id: "T-0366", date: "2025-05-16", category: "events-maintenance", memo: "purchase order", amountCents: 86206 },
  { id: "T-0367", date: "2025-02-21", category: "fleet-supplies", memo: "restock order", amountCents: 42388 },
  { id: "T-0368", date: "2025-03-14", category: "studio-equipment", memo: "net-30 payment", amountCents: 82083 },
  { id: "T-0369", date: "2025-04-05", category: "training-supplies", memo: "bulk order", amountCents: 44727 },
  { id: "T-0370", date: "2025-01-11", category: "training-services", memo: "expense report", amountCents: 18876 },
  { id: "T-0371", date: "2025-05-28", category: "lab-equipment", memo: "reimbursement", amountCents: 28798 },
  { id: "T-0372", date: "2025-04-06", category: "marketing-supplies", memo: "expense report", amountCents: 97708 },
  { id: "T-0373", date: "2025-05-24", category: "lab-equipment", memo: "net-30 payment", amountCents: 11554 },
  { id: "T-0374", date: "2025-01-02", category: "marketing-equipment", memo: "purchase order", amountCents: 89829 },
  { id: "T-0375", date: "2025-03-04", category: "retail-supplies", memo: "restock order", amountCents: 22529 },
  { id: "T-0376", date: "2025-01-05", category: "retail-services", memo: "contract renewal", amountCents: 99196 },
  { id: "T-0377", date: "2025-01-12", category: "training-equipment", memo: "quarterly invoice", amountCents: 547 },
  { id: "T-0378", date: "2025-06-13", category: "training-services", memo: "emergency replacement", amountCents: 87348 },
  { id: "T-0379", date: "2025-02-08", category: "office-services", memo: "reimbursement", amountCents: 94304 },
  { id: "T-0380", date: "2025-06-19", category: "warehouse-supplies", memo: "contract renewal", amountCents: 70033 },
  { id: "T-0381", date: "2025-02-01", category: "fleet-maintenance", memo: "net-30 payment", amountCents: 89981 },
  { id: "T-0382", date: "2025-04-20", category: "warehouse-equipment", memo: "restock order", amountCents: 99967 },
  { id: "T-0383", date: "2025-02-21", category: "events-supplies", memo: "bulk order", amountCents: 56214 },
  { id: "T-0384", date: "2025-05-14", category: "warehouse-maintenance", memo: "expense report", amountCents: 23370 },
  { id: "T-0385", date: "2025-01-06", category: "training-maintenance", memo: "purchase order", amountCents: 44038 },
  { id: "T-0386", date: "2025-06-07", category: "marketing-supplies", memo: "contract renewal", amountCents: 25772 },
  { id: "T-0387", date: "2025-04-18", category: "warehouse-maintenance", memo: "contract renewal", amountCents: 76737 },
  { id: "T-0388", date: "2025-04-13", category: "marketing-maintenance", memo: "expense report", amountCents: 44344 },
  { id: "T-0389", date: "2025-06-05", category: "events-maintenance", memo: "net-30 payment", amountCents: 48761 },
  { id: "T-0390", date: "2025-05-21", category: "training-supplies", memo: "quarterly invoice", amountCents: 90094 },
  { id: "T-0391", date: "2025-02-15", category: "training-maintenance", memo: "quarterly invoice", amountCents: 65179 },
  { id: "T-0392", date: "2025-06-06", category: "fleet-services", memo: "reimbursement", amountCents: 94000 },
  { id: "T-0393", date: "2025-04-11", category: "lab-services", memo: "quarterly invoice", amountCents: 96683 },
  { id: "T-0394", date: "2025-03-08", category: "warehouse-supplies", memo: "quarterly invoice", amountCents: 8115 },
  { id: "T-0395", date: "2025-05-26", category: "field-services", memo: "service call", amountCents: 97797 },
  { id: "T-0396", date: "2025-06-13", category: "studio-equipment", memo: "quarterly invoice", amountCents: 16489 },
  { id: "T-0397", date: "2025-01-12", category: "facilities-supplies", memo: "net-30 payment", amountCents: 14847 },
  { id: "T-0398", date: "2025-06-15", category: "events-supplies", memo: "emergency replacement", amountCents: 73467 },
  { id: "T-0399", date: "2025-06-13", category: "training-equipment", memo: "service call", amountCents: 85815 },
  { id: "T-0400", date: "2025-05-20", category: "warehouse-equipment", memo: "bulk order", amountCents: 25916 },
  { id: "T-0401", date: "2025-04-19", category: "training-supplies", memo: "one-off purchase", amountCents: 86835 },
  { id: "T-0402", date: "2025-06-12", category: "office-supplies", memo: "restock order", amountCents: 13386 },
  { id: "T-0403", date: "2025-05-22", category: "warehouse-maintenance", memo: "contract renewal", amountCents: 85868 },
  { id: "T-0404", date: "2025-05-20", category: "office-equipment", memo: "reimbursement", amountCents: 92571 },
  { id: "T-0405", date: "2025-04-15", category: "field-services", memo: "service call", amountCents: 54240 },
  { id: "T-0406", date: "2025-03-28", category: "office-equipment", memo: "recurring charge", amountCents: 2799 },
  { id: "T-0407", date: "2025-03-27", category: "office-services", memo: "contract renewal", amountCents: 81658 },
  { id: "T-0408", date: "2025-02-24", category: "retail-supplies", memo: "emergency replacement", amountCents: 15630 },
  { id: "T-0409", date: "2025-05-09", category: "training-maintenance", memo: "recurring charge", amountCents: 79067 },
  { id: "T-0410", date: "2025-02-10", category: "studio-maintenance", memo: "quarterly invoice", amountCents: 82414 },
  { id: "T-0411", date: "2025-03-15", category: "fleet-maintenance", memo: "quarterly invoice", amountCents: 93558 },
  { id: "T-0412", date: "2025-01-02", category: "events-equipment", memo: "restock order", amountCents: 98511 },
  { id: "T-0413", date: "2025-01-15", category: "office-services", memo: "purchase order", amountCents: 3457 },
  { id: "T-0414", date: "2025-01-15", category: "lab-equipment", memo: "service call", amountCents: 39615 },
  { id: "T-0415", date: "2025-03-28", category: "field-maintenance", memo: "contract renewal", amountCents: 32771 },
  { id: "T-0416", date: "2025-02-19", category: "retail-equipment", memo: "quarterly invoice", amountCents: 43450 },
  { id: "T-0417", date: "2025-05-16", category: "field-supplies", memo: "contract renewal", amountCents: 25933 },
  { id: "T-0418", date: "2025-03-14", category: "events-maintenance", memo: "one-off purchase", amountCents: 84726 },
  { id: "T-0419", date: "2025-05-16", category: "warehouse-equipment", memo: "service call", amountCents: 85210 },
  { id: "T-0420", date: "2025-03-13", category: "facilities-maintenance", memo: "quarterly invoice", amountCents: 56653 },
  { id: "T-0421", date: "2025-06-19", category: "field-services", memo: "contract renewal", amountCents: 56841 },
  { id: "T-0422", date: "2025-02-13", category: "training-maintenance", memo: "reimbursement", amountCents: 88139 },
  { id: "T-0423", date: "2025-06-03", category: "marketing-services", memo: "reimbursement", amountCents: 23665 },
  { id: "T-0424", date: "2025-03-26", category: "events-supplies", memo: "bulk order", amountCents: 39044 },
  { id: "T-0425", date: "2025-02-17", category: "training-services", memo: "net-30 payment", amountCents: 51224 },
  { id: "T-0426", date: "2025-03-11", category: "training-maintenance", memo: "purchase order", amountCents: 3649 },
  { id: "T-0427", date: "2025-06-12", category: "events-equipment", memo: "bulk order", amountCents: 33071 },
  { id: "T-0428", date: "2025-03-07", category: "lab-supplies", memo: "quarterly invoice", amountCents: 57252 },
  { id: "T-0429", date: "2025-03-14", category: "marketing-equipment", memo: "one-off purchase", amountCents: 80778 },
  { id: "T-0430", date: "2025-04-23", category: "studio-supplies", memo: "reimbursement", amountCents: 27331 },
  { id: "T-0431", date: "2025-06-13", category: "fleet-supplies", memo: "contract renewal", amountCents: 93183 },
  { id: "T-0432", date: "2025-04-03", category: "marketing-equipment", memo: "expense report", amountCents: 16403 },
  { id: "T-0433", date: "2025-05-17", category: "events-services", memo: "emergency replacement", amountCents: 93538 },
  { id: "T-0434", date: "2025-02-01", category: "field-equipment", memo: "purchase order", amountCents: 30441 },
  { id: "T-0435", date: "2025-02-26", category: "fleet-equipment", memo: "reimbursement", amountCents: 73407 },
  { id: "T-0436", date: "2025-03-20", category: "events-equipment", memo: "expense report", amountCents: 14144 },
  { id: "T-0437", date: "2025-04-12", category: "fleet-maintenance", memo: "restock order", amountCents: 4110 },
  { id: "T-0438", date: "2025-06-09", category: "lab-services", memo: "emergency replacement", amountCents: 44072 },
  { id: "T-0439", date: "2025-01-18", category: "events-supplies", memo: "net-30 payment", amountCents: 94045 },
  { id: "T-0440", date: "2025-02-22", category: "events-equipment", memo: "net-30 payment", amountCents: 20761 },
  { id: "T-0441", date: "2025-05-12", category: "events-equipment", memo: "one-off purchase", amountCents: 98110 },
  { id: "T-0442", date: "2025-03-14", category: "training-supplies", memo: "expense report", amountCents: 15177 },
  { id: "T-0443", date: "2025-04-13", category: "studio-equipment", memo: "one-off purchase", amountCents: 29810 },
  { id: "T-0444", date: "2025-04-23", category: "facilities-maintenance", memo: "purchase order", amountCents: 85825 },
  { id: "T-0445", date: "2025-03-28", category: "office-maintenance", memo: "service call", amountCents: 93779 },
  { id: "T-0446", date: "2025-03-08", category: "training-equipment", memo: "bulk order", amountCents: 34356 },
  { id: "T-0447", date: "2025-02-09", category: "office-equipment", memo: "purchase order", amountCents: 19870 },
  { id: "T-0448", date: "2025-04-14", category: "events-maintenance", memo: "quarterly invoice", amountCents: 39694 },
  { id: "T-0449", date: "2025-06-18", category: "studio-maintenance", memo: "reimbursement", amountCents: 86977 },
  { id: "T-0450", date: "2025-03-14", category: "marketing-services", memo: "quarterly invoice", amountCents: 15359 },
  { id: "T-0451", date: "2025-04-03", category: "vendor-services", memo: "quarterly invoice", amountCents: 84728 },
  { id: "T-0452", date: "2025-04-13", category: "lab-services", memo: "net-30 payment", amountCents: 16144 },
  { id: "T-0453", date: "2025-05-18", category: "studio-equipment", memo: "one-off purchase", amountCents: 27761 },
  { id: "T-0454", date: "2025-02-16", category: "studio-maintenance", memo: "service call", amountCents: 65389 },
  { id: "T-0455", date: "2025-02-28", category: "field-equipment", memo: "contract renewal", amountCents: 15631 },
  { id: "T-0456", date: "2025-03-10", category: "office-services", memo: "bulk order", amountCents: 18907 },
  { id: "T-0457", date: "2025-05-15", category: "marketing-supplies", memo: "quarterly invoice", amountCents: 67536 },
  { id: "T-0458", date: "2025-05-20", category: "training-supplies", memo: "bulk order", amountCents: 81342 },
  { id: "T-0459", date: "2025-05-12", category: "events-services", memo: "restock order", amountCents: 22789 },
  { id: "T-0460", date: "2025-05-10", category: "fleet-supplies", memo: "expense report", amountCents: 43518 },
  { id: "T-0461", date: "2025-03-10", category: "events-supplies", memo: "expense report", amountCents: 99723 },
  { id: "T-0462", date: "2025-02-09", category: "warehouse-equipment", memo: "one-off purchase", amountCents: 59705 },
  { id: "T-0463", date: "2025-03-04", category: "vendor-maintenance", memo: "emergency replacement", amountCents: 38335 },
  { id: "T-0464", date: "2025-05-18", category: "fleet-supplies", memo: "contract renewal", amountCents: 24252 },
  { id: "T-0465", date: "2025-06-19", category: "facilities-supplies", memo: "reimbursement", amountCents: 17416 },
  { id: "T-0466", date: "2025-06-05", category: "lab-services", memo: "quarterly invoice", amountCents: 81215 },
  { id: "T-0467", date: "2025-01-15", category: "vendor-equipment", memo: "emergency replacement", amountCents: 19045 },
  { id: "T-0468", date: "2025-03-28", category: "retail-equipment", memo: "purchase order", amountCents: 94831 },
  { id: "T-0469", date: "2025-04-14", category: "events-supplies", memo: "expense report", amountCents: 48347 },
  { id: "T-0470", date: "2025-02-07", category: "office-services", memo: "contract renewal", amountCents: 30527 },
  { id: "T-0471", date: "2025-03-01", category: "fleet-maintenance", memo: "emergency replacement", amountCents: 41340 },
  { id: "T-0472", date: "2025-02-05", category: "fleet-services", memo: "purchase order", amountCents: 82912 },
  { id: "T-0473", date: "2025-02-23", category: "retail-maintenance", memo: "quarterly invoice", amountCents: 70159 },
  { id: "T-0474", date: "2025-05-17", category: "facilities-equipment", memo: "service call", amountCents: 24589 },
  { id: "T-0475", date: "2025-01-27", category: "studio-services", memo: "purchase order", amountCents: 65125 },
  { id: "T-0476", date: "2025-04-20", category: "studio-supplies", memo: "quarterly invoice", amountCents: 72878 },
  { id: "T-0477", date: "2025-04-10", category: "retail-services", memo: "expense report", amountCents: 66350 },
  { id: "T-0478", date: "2025-06-27", category: "marketing-equipment", memo: "contract renewal", amountCents: 99206 },
  { id: "T-0479", date: "2025-02-12", category: "marketing-services", memo: "net-30 payment", amountCents: 91813 },
  { id: "T-0480", date: "2025-05-14", category: "fleet-services", memo: "restock order", amountCents: 41750 },
  { id: "T-0481", date: "2025-03-10", category: "training-supplies", memo: "recurring charge", amountCents: 10303 },
  { id: "T-0482", date: "2025-02-22", category: "marketing-services", memo: "emergency replacement", amountCents: 34393 },
  { id: "T-0483", date: "2025-01-18", category: "studio-supplies", memo: "one-off purchase", amountCents: 54441 },
  { id: "T-0484", date: "2025-05-10", category: "studio-equipment", memo: "one-off purchase", amountCents: 92687 },
  { id: "T-0485", date: "2025-02-06", category: "studio-equipment", memo: "expense report", amountCents: 14504 },
  { id: "T-0486", date: "2025-03-11", category: "office-services", memo: "reimbursement", amountCents: 81731 },
  { id: "T-0487", date: "2025-02-18", category: "facilities-services", memo: "one-off purchase", amountCents: 2149 },
  { id: "T-0488", date: "2025-03-08", category: "vendor-maintenance", memo: "net-30 payment", amountCents: 11491 },
  { id: "T-0489", date: "2025-05-22", category: "field-equipment", memo: "recurring charge", amountCents: 88174 },
  { id: "T-0490", date: "2025-04-03", category: "studio-equipment", memo: "restock order", amountCents: 35590 },
  { id: "T-0491", date: "2025-04-24", category: "warehouse-maintenance", memo: "one-off purchase", amountCents: 53426 },
  { id: "T-0492", date: "2025-03-21", category: "retail-services", memo: "net-30 payment", amountCents: 36289 },
  { id: "T-0493", date: "2025-06-11", category: "events-maintenance", memo: "restock order", amountCents: 66236 },
  { id: "T-0494", date: "2025-05-06", category: "facilities-supplies", memo: "one-off purchase", amountCents: 62912 },
  { id: "T-0495", date: "2025-03-12", category: "warehouse-equipment", memo: "recurring charge", amountCents: 1731 },
  { id: "T-0496", date: "2025-05-22", category: "vendor-maintenance", memo: "purchase order", amountCents: 45111 },
  { id: "T-0497", date: "2025-04-12", category: "marketing-equipment", memo: "quarterly invoice", amountCents: 81162 },
  { id: "T-0498", date: "2025-04-17", category: "office-equipment", memo: "reimbursement", amountCents: 99133 },
  { id: "T-0499", date: "2025-06-17", category: "marketing-maintenance", memo: "one-off purchase", amountCents: 14889 },
  { id: "T-0500", date: "2025-04-17", category: "warehouse-maintenance", memo: "bulk order", amountCents: 8451 },
  { id: "T-0501", date: "2025-06-07", category: "training-equipment", memo: "reimbursement", amountCents: 48423 },
  { id: "T-0502", date: "2025-05-15", category: "office-maintenance", memo: "purchase order", amountCents: 37376 },
  { id: "T-0503", date: "2025-01-20", category: "training-supplies", memo: "one-off purchase", amountCents: 92444 },
  { id: "T-0504", date: "2025-04-04", category: "facilities-equipment", memo: "purchase order", amountCents: 59758 },
  { id: "T-0505", date: "2025-02-19", category: "training-maintenance", memo: "purchase order", amountCents: 92528 },
  { id: "T-0506", date: "2025-06-12", category: "events-maintenance", memo: "restock order", amountCents: 72319 },
  { id: "T-0507", date: "2025-06-13", category: "retail-maintenance", memo: "emergency replacement", amountCents: 28290 },
  { id: "T-0508", date: "2025-05-16", category: "retail-supplies", memo: "purchase order", amountCents: 27031 },
  { id: "T-0509", date: "2025-02-13", category: "training-equipment", memo: "service call", amountCents: 595 },
  { id: "T-0510", date: "2025-04-10", category: "fleet-supplies", memo: "restock order", amountCents: 26023 },
  { id: "T-0511", date: "2025-06-17", category: "field-maintenance", memo: "quarterly invoice", amountCents: 32774 },
  { id: "T-0512", date: "2025-05-02", category: "events-supplies", memo: "purchase order", amountCents: 11113 },
  { id: "T-0513", date: "2025-03-15", category: "vendor-maintenance", memo: "recurring charge", amountCents: 55263 },
  { id: "T-0514", date: "2025-03-27", category: "events-equipment", memo: "bulk order", amountCents: 35177 },
  { id: "T-0515", date: "2025-04-12", category: "field-supplies", memo: "contract renewal", amountCents: 66609 },
  { id: "T-0516", date: "2025-06-01", category: "training-maintenance", memo: "service call", amountCents: 79072 },
  { id: "T-0517", date: "2025-06-22", category: "warehouse-supplies", memo: "purchase order", amountCents: 68169 },
  { id: "T-0518", date: "2025-01-05", category: "marketing-maintenance", memo: "recurring charge", amountCents: 23807 },
  { id: "T-0519", date: "2025-01-18", category: "warehouse-maintenance", memo: "bulk order", amountCents: 76613 },
  { id: "T-0520", date: "2025-06-02", category: "fleet-supplies", memo: "expense report", amountCents: 87618 },
  { id: "T-0521", date: "2025-02-17", category: "training-equipment", memo: "one-off purchase", amountCents: 70267 },
  { id: "T-0522", date: "2025-05-14", category: "office-supplies", memo: "quarterly invoice", amountCents: 6914 },
  { id: "T-0523", date: "2025-02-03", category: "fleet-maintenance", memo: "reimbursement", amountCents: 67969 },
  { id: "T-0524", date: "2025-04-06", category: "facilities-services", memo: "restock order", amountCents: 36696 },
  { id: "T-0525", date: "2025-06-15", category: "lab-supplies", memo: "recurring charge", amountCents: 82804 },
  { id: "T-0526", date: "2025-01-20", category: "field-equipment", memo: "purchase order", amountCents: 18909 },
  { id: "T-0527", date: "2025-04-25", category: "fleet-maintenance", memo: "service call", amountCents: 22195 },
  { id: "T-0528", date: "2025-02-02", category: "marketing-supplies", memo: "reimbursement", amountCents: 20817 },
  { id: "T-0529", date: "2025-05-22", category: "vendor-services", memo: "service call", amountCents: 73083 },
  { id: "T-0530", date: "2025-04-23", category: "training-services", memo: "recurring charge", amountCents: 18253 },
  { id: "T-0531", date: "2025-04-18", category: "training-equipment", memo: "quarterly invoice", amountCents: 28738 },
  { id: "T-0532", date: "2025-01-12", category: "training-services", memo: "purchase order", amountCents: 59171 },
  { id: "T-0533", date: "2025-03-17", category: "training-maintenance", memo: "net-30 payment", amountCents: 64931 },
  { id: "T-0534", date: "2025-04-06", category: "field-supplies", memo: "bulk order", amountCents: 56332 },
  { id: "T-0535", date: "2025-05-08", category: "marketing-equipment", memo: "purchase order", amountCents: 52459 },
  { id: "T-0536", date: "2025-04-25", category: "studio-maintenance", memo: "contract renewal", amountCents: 62099 },
  { id: "T-0537", date: "2025-06-06", category: "vendor-services", memo: "expense report", amountCents: 27777 },
  { id: "T-0538", date: "2025-05-04", category: "field-services", memo: "quarterly invoice", amountCents: 75182 },
  { id: "T-0539", date: "2025-06-08", category: "office-maintenance", memo: "restock order", amountCents: 24397 },
  { id: "T-0540", date: "2025-03-10", category: "vendor-maintenance", memo: "expense report", amountCents: 66509 },
  { id: "T-0541", date: "2025-05-26", category: "studio-supplies", memo: "reimbursement", amountCents: 30229 },
  { id: "T-0542", date: "2025-04-20", category: "training-services", memo: "emergency replacement", amountCents: 49937 },
  { id: "T-0543", date: "2025-05-27", category: "warehouse-equipment", memo: "quarterly invoice", amountCents: 55375 },
  { id: "T-0544", date: "2025-06-02", category: "studio-services", memo: "purchase order", amountCents: 12760 },
  { id: "T-0545", date: "2025-02-28", category: "training-services", memo: "reimbursement", amountCents: 58114 },
  { id: "T-0546", date: "2025-03-12", category: "lab-supplies", memo: "purchase order", amountCents: 96468 },
  { id: "T-0547", date: "2025-01-14", category: "warehouse-services", memo: "purchase order", amountCents: 69215 },
  { id: "T-0548", date: "2025-06-15", category: "events-services", memo: "purchase order", amountCents: 92451 },
  { id: "T-0549", date: "2025-06-07", category: "vendor-services", memo: "quarterly invoice", amountCents: 15179 },
  { id: "T-0550", date: "2025-04-01", category: "fleet-maintenance", memo: "contract renewal", amountCents: 74817 },
  { id: "T-0551", date: "2025-03-14", category: "office-maintenance", memo: "net-30 payment", amountCents: 9181 },
  { id: "T-0552", date: "2025-06-06", category: "warehouse-maintenance", memo: "purchase order", amountCents: 50497 },
  { id: "T-0553", date: "2025-01-14", category: "training-equipment", memo: "net-30 payment", amountCents: 35310 },
  { id: "T-0554", date: "2025-05-14", category: "vendor-supplies", memo: "expense report", amountCents: 97767 },
  { id: "T-0555", date: "2025-06-22", category: "facilities-maintenance", memo: "contract renewal", amountCents: 65114 },
  { id: "T-0556", date: "2025-02-09", category: "office-equipment", memo: "restock order", amountCents: 38986 },
  { id: "T-0557", date: "2025-04-10", category: "office-supplies", memo: "bulk order", amountCents: 79725 },
  { id: "T-0558", date: "2025-02-04", category: "events-services", memo: "recurring charge", amountCents: 34333 },
  { id: "T-0559", date: "2025-06-12", category: "marketing-equipment", memo: "net-30 payment", amountCents: 95105 },
  { id: "T-0560", date: "2025-02-11", category: "lab-equipment", memo: "quarterly invoice", amountCents: 27400 },
  { id: "T-0561", date: "2025-04-12", category: "events-equipment", memo: "reimbursement", amountCents: 59905 },
  { id: "T-0562", date: "2025-04-23", category: "training-equipment", memo: "restock order", amountCents: 49491 },
  { id: "T-0563", date: "2025-01-06", category: "fleet-equipment", memo: "recurring charge", amountCents: 44140 },
  { id: "T-0564", date: "2025-02-03", category: "vendor-maintenance", memo: "service call", amountCents: 87731 },
  { id: "T-0565", date: "2025-02-01", category: "fleet-maintenance", memo: "one-off purchase", amountCents: 90149 },
  { id: "T-0566", date: "2025-04-08", category: "warehouse-maintenance", memo: "reimbursement", amountCents: 38594 },
  { id: "T-0567", date: "2025-04-01", category: "office-maintenance", memo: "service call", amountCents: 2735 },
  { id: "T-0568", date: "2025-04-05", category: "marketing-maintenance", memo: "reimbursement", amountCents: 92800 },
  { id: "T-0569", date: "2025-06-27", category: "events-maintenance", memo: "restock order", amountCents: 79168 },
  { id: "T-0570", date: "2025-04-06", category: "fleet-maintenance", memo: "bulk order", amountCents: 97986 },
  { id: "T-0571", date: "2025-04-21", category: "facilities-supplies", memo: "emergency replacement", amountCents: 60066 },
  { id: "T-0572", date: "2025-01-07", category: "training-services", memo: "net-30 payment", amountCents: 25288 },
  { id: "T-0573", date: "2025-05-03", category: "warehouse-equipment", memo: "recurring charge", amountCents: 9259 },
  { id: "T-0574", date: "2025-06-15", category: "facilities-equipment", memo: "bulk order", amountCents: 82973 },
  { id: "T-0575", date: "2025-03-19", category: "fleet-maintenance", memo: "emergency replacement", amountCents: 89816 },
  { id: "T-0576", date: "2025-05-18", category: "vendor-equipment", memo: "service call", amountCents: 88538 },
  { id: "T-0577", date: "2025-03-06", category: "marketing-services", memo: "quarterly invoice", amountCents: 26759 },
  { id: "T-0578", date: "2025-03-26", category: "lab-maintenance", memo: "net-30 payment", amountCents: 25520 },
  { id: "T-0579", date: "2025-03-28", category: "studio-equipment", memo: "restock order", amountCents: 28326 },
  { id: "T-0580", date: "2025-03-23", category: "lab-equipment", memo: "net-30 payment", amountCents: 60331 },
  { id: "T-0581", date: "2025-01-24", category: "fleet-supplies", memo: "service call", amountCents: 36803 },
  { id: "T-0582", date: "2025-06-03", category: "events-maintenance", memo: "quarterly invoice", amountCents: 90871 },
  { id: "T-0583", date: "2025-04-26", category: "warehouse-services", memo: "net-30 payment", amountCents: 23503 },
  { id: "T-0584", date: "2025-01-17", category: "field-maintenance", memo: "emergency replacement", amountCents: 10922 },
  { id: "T-0585", date: "2025-05-02", category: "field-supplies", memo: "expense report", amountCents: 21977 },
  { id: "T-0586", date: "2025-01-27", category: "field-equipment", memo: "one-off purchase", amountCents: 2916 },
  { id: "T-0587", date: "2025-04-16", category: "facilities-services", memo: "quarterly invoice", amountCents: 70498 },
  { id: "T-0588", date: "2025-02-21", category: "office-equipment", memo: "bulk order", amountCents: 30698 },
  { id: "T-0589", date: "2025-06-08", category: "field-maintenance", memo: "expense report", amountCents: 75755 },
  { id: "T-0590", date: "2025-01-24", category: "training-services", memo: "purchase order", amountCents: 41327 },
  { id: "T-0591", date: "2025-04-24", category: "studio-supplies", memo: "one-off purchase", amountCents: 4434 },
  { id: "T-0592", date: "2025-01-19", category: "fleet-services", memo: "service call", amountCents: 40499 },
  { id: "T-0593", date: "2025-05-02", category: "vendor-supplies", memo: "net-30 payment", amountCents: 65467 },
  { id: "T-0594", date: "2025-06-15", category: "facilities-equipment", memo: "recurring charge", amountCents: 79734 },
  { id: "T-0595", date: "2025-04-18", category: "lab-services", memo: "reimbursement", amountCents: 34321 },
  { id: "T-0596", date: "2025-05-03", category: "fleet-equipment", memo: "quarterly invoice", amountCents: 47496 },
  { id: "T-0597", date: "2025-06-01", category: "marketing-supplies", memo: "contract renewal", amountCents: 69621 },
  { id: "T-0598", date: "2025-02-03", category: "lab-services", memo: "bulk order", amountCents: 86535 },
  { id: "T-0599", date: "2025-04-23", category: "fleet-supplies", memo: "expense report", amountCents: 55536 },
  { id: "T-0600", date: "2025-06-05", category: "lab-maintenance", memo: "expense report", amountCents: 29413 },
  { id: "T-0601", date: "2025-03-04", category: "vendor-supplies", memo: "bulk order", amountCents: 92756 },
  { id: "T-0602", date: "2025-05-21", category: "retail-supplies", memo: "reimbursement", amountCents: 13083 },
  { id: "T-0603", date: "2025-01-21", category: "marketing-maintenance", memo: "restock order", amountCents: 54843 },
  { id: "T-0604", date: "2025-04-24", category: "training-supplies", memo: "expense report", amountCents: 45343 },
  { id: "T-0605", date: "2025-04-22", category: "warehouse-supplies", memo: "reimbursement", amountCents: 25370 },
  { id: "T-0606", date: "2025-05-20", category: "marketing-maintenance", memo: "net-30 payment", amountCents: 95480 },
  { id: "T-0607", date: "2025-06-20", category: "retail-services", memo: "contract renewal", amountCents: 28922 },
  { id: "T-0608", date: "2025-02-27", category: "vendor-supplies", memo: "recurring charge", amountCents: 56469 },
  { id: "T-0609", date: "2025-03-24", category: "marketing-supplies", memo: "bulk order", amountCents: 57047 },
  { id: "T-0610", date: "2025-05-11", category: "fleet-maintenance", memo: "contract renewal", amountCents: 66597 },
  { id: "T-0611", date: "2025-04-26", category: "vendor-maintenance", memo: "expense report", amountCents: 83181 },
  { id: "T-0612", date: "2025-06-08", category: "lab-services", memo: "restock order", amountCents: 38636 },
  { id: "T-0613", date: "2025-01-20", category: "marketing-supplies", memo: "bulk order", amountCents: 50853 },
  { id: "T-0614", date: "2025-04-18", category: "retail-services", memo: "purchase order", amountCents: 77152 },
  { id: "T-0615", date: "2025-02-03", category: "vendor-maintenance", memo: "restock order", amountCents: 57937 },
  { id: "T-0616", date: "2025-04-19", category: "studio-equipment", memo: "service call", amountCents: 53887 },
  { id: "T-0617", date: "2025-02-13", category: "events-maintenance", memo: "quarterly invoice", amountCents: 18990 },
  { id: "T-0618", date: "2025-06-23", category: "training-services", memo: "emergency replacement", amountCents: 64054 },
  { id: "T-0619", date: "2025-03-09", category: "facilities-maintenance", memo: "bulk order", amountCents: 62861 },
  { id: "T-0620", date: "2025-02-18", category: "office-supplies", memo: "net-30 payment", amountCents: 75295 },
  { id: "T-0621", date: "2025-05-21", category: "field-maintenance", memo: "restock order", amountCents: 3558 },
  { id: "T-0622", date: "2025-06-24", category: "training-services", memo: "service call", amountCents: 3566 },
  { id: "T-0623", date: "2025-02-21", category: "field-equipment", memo: "contract renewal", amountCents: 48835 },
  { id: "T-0624", date: "2025-03-13", category: "studio-services", memo: "bulk order", amountCents: 65477 },
  { id: "T-0625", date: "2025-04-08", category: "events-services", memo: "quarterly invoice", amountCents: 30143 },
  { id: "T-0626", date: "2025-02-08", category: "training-maintenance", memo: "bulk order", amountCents: 29547 },
  { id: "T-0627", date: "2025-06-23", category: "field-supplies", memo: "restock order", amountCents: 85349 },
  { id: "T-0628", date: "2025-01-27", category: "field-equipment", memo: "restock order", amountCents: 76051 },
  { id: "T-0629", date: "2025-04-27", category: "field-maintenance", memo: "bulk order", amountCents: 80474 },
  { id: "T-0630", date: "2025-02-27", category: "office-services", memo: "recurring charge", amountCents: 20496 },
  { id: "T-0631", date: "2025-06-20", category: "vendor-supplies", memo: "net-30 payment", amountCents: 52682 },
  { id: "T-0632", date: "2025-06-11", category: "retail-equipment", memo: "recurring charge", amountCents: 15812 },
  { id: "T-0633", date: "2025-05-06", category: "lab-services", memo: "service call", amountCents: 73981 },
  { id: "T-0634", date: "2025-03-20", category: "events-supplies", memo: "purchase order", amountCents: 58065 },
  { id: "T-0635", date: "2025-06-09", category: "events-services", memo: "emergency replacement", amountCents: 6400 },
  { id: "T-0636", date: "2025-04-27", category: "lab-equipment", memo: "service call", amountCents: 20707 },
  { id: "T-0637", date: "2025-05-13", category: "warehouse-services", memo: "bulk order", amountCents: 73142 },
  { id: "T-0638", date: "2025-06-06", category: "events-services", memo: "net-30 payment", amountCents: 78753 },
  { id: "T-0639", date: "2025-06-14", category: "facilities-equipment", memo: "purchase order", amountCents: 48836 },
  { id: "T-0640", date: "2025-05-15", category: "vendor-supplies", memo: "recurring charge", amountCents: 67561 },
  { id: "T-0641", date: "2025-04-05", category: "training-maintenance", memo: "emergency replacement", amountCents: 29889 },
  { id: "T-0642", date: "2025-01-06", category: "lab-equipment", memo: "one-off purchase", amountCents: 80683 },
  { id: "T-0643", date: "2025-01-15", category: "studio-equipment", memo: "bulk order", amountCents: 18922 },
  { id: "T-0644", date: "2025-03-12", category: "events-supplies", memo: "purchase order", amountCents: 3654 },
  { id: "T-0645", date: "2025-05-01", category: "studio-supplies", memo: "contract renewal", amountCents: 77172 },
  { id: "T-0646", date: "2025-04-13", category: "warehouse-maintenance", memo: "one-off purchase", amountCents: 18877 },
  { id: "T-0647", date: "2025-04-17", category: "marketing-maintenance", memo: "contract renewal", amountCents: 30670 },
  { id: "T-0648", date: "2025-02-25", category: "retail-services", memo: "recurring charge", amountCents: 39124 },
  { id: "T-0649", date: "2025-04-03", category: "lab-equipment", memo: "contract renewal", amountCents: 92951 },
  { id: "T-0650", date: "2025-02-01", category: "marketing-maintenance", memo: "service call", amountCents: 5384 },
  { id: "T-0651", date: "2025-04-22", category: "lab-supplies", memo: "bulk order", amountCents: 72301 },
  { id: "T-0652", date: "2025-03-23", category: "events-equipment", memo: "expense report", amountCents: 76671 },
  { id: "T-0653", date: "2025-03-26", category: "warehouse-maintenance", memo: "reimbursement", amountCents: 14690 },
  { id: "T-0654", date: "2025-04-18", category: "training-maintenance", memo: "bulk order", amountCents: 36955 },
  { id: "T-0655", date: "2025-02-19", category: "vendor-equipment", memo: "recurring charge", amountCents: 58658 },
  { id: "T-0656", date: "2025-06-05", category: "office-maintenance", memo: "expense report", amountCents: 31016 },
  { id: "T-0657", date: "2025-05-04", category: "marketing-maintenance", memo: "recurring charge", amountCents: 15729 },
  { id: "T-0658", date: "2025-03-14", category: "field-supplies", memo: "purchase order", amountCents: 7938 },
  { id: "T-0659", date: "2025-04-02", category: "events-maintenance", memo: "purchase order", amountCents: 16409 },
  { id: "T-0660", date: "2025-02-26", category: "studio-services", memo: "purchase order", amountCents: 3942 },
  { id: "T-0661", date: "2025-04-21", category: "events-services", memo: "reimbursement", amountCents: 58830 },
  { id: "T-0662", date: "2025-01-11", category: "office-equipment", memo: "emergency replacement", amountCents: 42047 },
  { id: "T-0663", date: "2025-06-21", category: "marketing-supplies", memo: "bulk order", amountCents: 18350 },
  { id: "T-0664", date: "2025-05-01", category: "marketing-maintenance", memo: "restock order", amountCents: 76502 },
  { id: "T-0665", date: "2025-03-17", category: "events-equipment", memo: "one-off purchase", amountCents: 33575 },
  { id: "T-0666", date: "2025-03-16", category: "retail-maintenance", memo: "recurring charge", amountCents: 1700 },
  { id: "T-0667", date: "2025-03-11", category: "field-equipment", memo: "quarterly invoice", amountCents: 18526 },
  { id: "T-0668", date: "2025-02-18", category: "fleet-supplies", memo: "restock order", amountCents: 86419 },
  { id: "T-0669", date: "2025-05-11", category: "office-services", memo: "one-off purchase", amountCents: 16777 },
  { id: "T-0670", date: "2025-05-16", category: "field-services", memo: "emergency replacement", amountCents: 67625 },
  { id: "T-0671", date: "2025-03-12", category: "vendor-supplies", memo: "bulk order", amountCents: 14622 },
  { id: "T-0672", date: "2025-05-11", category: "training-supplies", memo: "restock order", amountCents: 65066 },
  { id: "T-0673", date: "2025-04-11", category: "training-supplies", memo: "contract renewal", amountCents: 17409 },
  { id: "T-0674", date: "2025-04-07", category: "field-equipment", memo: "contract renewal", amountCents: 34593 },
  { id: "T-0675", date: "2025-02-01", category: "vendor-equipment", memo: "purchase order", amountCents: 91727 },
  { id: "T-0676", date: "2025-03-20", category: "facilities-maintenance", memo: "one-off purchase", amountCents: 81350 },
  { id: "T-0677", date: "2025-02-19", category: "retail-equipment", memo: "contract renewal", amountCents: 38220 },
  { id: "T-0678", date: "2025-02-02", category: "marketing-services", memo: "purchase order", amountCents: 71854 },
  { id: "T-0679", date: "2025-06-19", category: "vendor-maintenance", memo: "contract renewal", amountCents: 13398 },
  { id: "T-0680", date: "2025-06-27", category: "studio-supplies", memo: "service call", amountCents: 33603 },
  { id: "T-0681", date: "2025-03-09", category: "retail-maintenance", memo: "one-off purchase", amountCents: 2155 },
  { id: "T-0682", date: "2025-05-18", category: "marketing-supplies", memo: "purchase order", amountCents: 14167 },
  { id: "T-0683", date: "2025-04-03", category: "marketing-supplies", memo: "service call", amountCents: 72456 },
  { id: "T-0684", date: "2025-04-11", category: "field-supplies", memo: "expense report", amountCents: 44422 },
  { id: "T-0685", date: "2025-02-22", category: "training-supplies", memo: "restock order", amountCents: 64516 },
  { id: "T-0686", date: "2025-02-14", category: "facilities-supplies", memo: "bulk order", amountCents: 31126 },
  { id: "T-0687", date: "2025-01-14", category: "retail-supplies", memo: "recurring charge", amountCents: 31972 },
  { id: "T-0688", date: "2025-06-18", category: "office-supplies", memo: "restock order", amountCents: 56058 },
  { id: "T-0689", date: "2025-06-25", category: "field-supplies", memo: "expense report", amountCents: 65850 },
  { id: "T-0690", date: "2025-06-02", category: "warehouse-maintenance", memo: "reimbursement", amountCents: 35032 },
  { id: "T-0691", date: "2025-04-24", category: "field-equipment", memo: "one-off purchase", amountCents: 36169 },
  { id: "T-0692", date: "2025-02-12", category: "fleet-services", memo: "reimbursement", amountCents: 73693 },
  { id: "T-0693", date: "2025-06-09", category: "training-services", memo: "restock order", amountCents: 65696 },
  { id: "T-0694", date: "2025-02-22", category: "field-maintenance", memo: "one-off purchase", amountCents: 17590 },
  { id: "T-0695", date: "2025-06-15", category: "training-maintenance", memo: "quarterly invoice", amountCents: 74433 },
  { id: "T-0696", date: "2025-01-16", category: "warehouse-services", memo: "recurring charge", amountCents: 62835 },
  { id: "T-0697", date: "2025-05-25", category: "events-services", memo: "contract renewal", amountCents: 78748 },
  { id: "T-0698", date: "2025-04-08", category: "training-equipment", memo: "expense report", amountCents: 3920 },
  { id: "T-0699", date: "2025-02-04", category: "office-maintenance", memo: "contract renewal", amountCents: 4356 },
  { id: "T-0700", date: "2025-04-06", category: "training-services", memo: "purchase order", amountCents: 25049 },
  { id: "T-0701", date: "2025-05-01", category: "field-maintenance", memo: "emergency replacement", amountCents: 21317 },
  { id: "T-0702", date: "2025-04-05", category: "studio-services", memo: "contract renewal", amountCents: 83736 },
  { id: "T-0703", date: "2025-06-10", category: "training-maintenance", memo: "contract renewal", amountCents: 34460 },
  { id: "T-0704", date: "2025-03-11", category: "fleet-maintenance", memo: "recurring charge", amountCents: 22221 },
  { id: "T-0705", date: "2025-03-22", category: "lab-equipment", memo: "service call", amountCents: 83822 },
  { id: "T-0706", date: "2025-05-09", category: "fleet-services", memo: "bulk order", amountCents: 15407 },
  { id: "T-0707", date: "2025-02-10", category: "events-maintenance", memo: "quarterly invoice", amountCents: 15816 },
  { id: "T-0708", date: "2025-02-01", category: "fleet-equipment", memo: "recurring charge", amountCents: 89869 },
  { id: "T-0709", date: "2025-05-06", category: "events-services", memo: "service call", amountCents: 98531 },
  { id: "T-0710", date: "2025-05-03", category: "lab-maintenance", memo: "one-off purchase", amountCents: 38665 },
  { id: "T-0711", date: "2025-06-20", category: "training-maintenance", memo: "one-off purchase", amountCents: 29364 },
  { id: "T-0712", date: "2025-04-16", category: "vendor-services", memo: "contract renewal", amountCents: 869 },
  { id: "T-0713", date: "2025-02-26", category: "facilities-supplies", memo: "one-off purchase", amountCents: 43021 },
  { id: "T-0714", date: "2025-01-01", category: "facilities-equipment", memo: "service call", amountCents: 45557 },
  { id: "T-0715", date: "2025-02-01", category: "lab-maintenance", memo: "net-30 payment", amountCents: 74328 },
  { id: "T-0716", date: "2025-05-24", category: "events-equipment", memo: "quarterly invoice", amountCents: 51023 },
  { id: "T-0717", date: "2025-04-01", category: "marketing-supplies", memo: "one-off purchase", amountCents: 17574 },
  { id: "T-0718", date: "2025-05-16", category: "warehouse-supplies", memo: "contract renewal", amountCents: 31833 },
  { id: "T-0719", date: "2025-06-19", category: "warehouse-services", memo: "restock order", amountCents: 79060 },
  { id: "T-0720", date: "2025-06-28", category: "office-maintenance", memo: "one-off purchase", amountCents: 9527 },
  { id: "T-0721", date: "2025-01-18", category: "warehouse-equipment", memo: "recurring charge", amountCents: 85265 },
  { id: "T-0722", date: "2025-01-15", category: "lab-maintenance", memo: "expense report", amountCents: 51871 },
  { id: "T-0723", date: "2025-04-01", category: "office-services", memo: "quarterly invoice", amountCents: 54516 },
  { id: "T-0724", date: "2025-05-19", category: "office-equipment", memo: "net-30 payment", amountCents: 57755 },
  { id: "T-0725", date: "2025-06-01", category: "marketing-services", memo: "net-30 payment", amountCents: 39618 },
  { id: "T-0726", date: "2025-06-26", category: "marketing-equipment", memo: "service call", amountCents: 50158 },
  { id: "T-0727", date: "2025-03-03", category: "fleet-services", memo: "quarterly invoice", amountCents: 87691 },
  { id: "T-0728", date: "2025-01-07", category: "lab-maintenance", memo: "net-30 payment", amountCents: 29544 },
  { id: "T-0729", date: "2025-02-23", category: "retail-equipment", memo: "net-30 payment", amountCents: 29966 },
  { id: "T-0730", date: "2025-02-06", category: "marketing-equipment", memo: "one-off purchase", amountCents: 45792 },
  { id: "T-0731", date: "2025-06-17", category: "marketing-services", memo: "one-off purchase", amountCents: 33944 },
  { id: "T-0732", date: "2025-03-19", category: "office-maintenance", memo: "recurring charge", amountCents: 93146 },
  { id: "T-0733", date: "2025-05-10", category: "retail-equipment", memo: "recurring charge", amountCents: 20784 },
  { id: "T-0734", date: "2025-01-03", category: "office-maintenance", memo: "contract renewal", amountCents: 96350 },
  { id: "T-0735", date: "2025-04-25", category: "training-equipment", memo: "reimbursement", amountCents: 73380 },
  { id: "T-0736", date: "2025-01-15", category: "facilities-maintenance", memo: "purchase order", amountCents: 41705 },
  { id: "T-0737", date: "2025-05-24", category: "lab-maintenance", memo: "service call", amountCents: 6529 },
  { id: "T-0738", date: "2025-01-08", category: "vendor-maintenance", memo: "one-off purchase", amountCents: 58472 },
  { id: "T-0739", date: "2025-03-19", category: "vendor-supplies", memo: "emergency replacement", amountCents: 35151 },
  { id: "T-0740", date: "2025-05-11", category: "retail-maintenance", memo: "service call", amountCents: 47892 },
  { id: "T-0741", date: "2025-06-08", category: "field-services", memo: "service call", amountCents: 55342 },
  { id: "T-0742", date: "2025-06-22", category: "retail-services", memo: "reimbursement", amountCents: 81799 },
  { id: "T-0743", date: "2025-03-28", category: "retail-maintenance", memo: "reimbursement", amountCents: 14235 },
  { id: "T-0744", date: "2025-06-25", category: "warehouse-equipment", memo: "purchase order", amountCents: 54469 },
  { id: "T-0745", date: "2025-06-24", category: "studio-services", memo: "bulk order", amountCents: 85269 },
  { id: "T-0746", date: "2025-06-20", category: "field-supplies", memo: "reimbursement", amountCents: 6532 },
  { id: "T-0747", date: "2025-06-19", category: "retail-services", memo: "restock order", amountCents: 17509 },
  { id: "T-0748", date: "2025-04-05", category: "fleet-maintenance", memo: "restock order", amountCents: 9857 },
  { id: "T-0749", date: "2025-05-15", category: "studio-supplies", memo: "recurring charge", amountCents: 3265 },
  { id: "T-0750", date: "2025-04-10", category: "training-maintenance", memo: "quarterly invoice", amountCents: 52450 },
  { id: "T-0751", date: "2025-02-14", category: "office-services", memo: "emergency replacement", amountCents: 27010 },
  { id: "T-0752", date: "2025-06-11", category: "events-services", memo: "quarterly invoice", amountCents: 56922 },
  { id: "T-0753", date: "2025-03-12", category: "vendor-maintenance", memo: "recurring charge", amountCents: 88477 },
  { id: "T-0754", date: "2025-02-15", category: "events-services", memo: "reimbursement", amountCents: 37853 },
  { id: "T-0755", date: "2025-05-16", category: "vendor-supplies", memo: "one-off purchase", amountCents: 89819 },
  { id: "T-0756", date: "2025-06-24", category: "training-maintenance", memo: "reimbursement", amountCents: 60048 },
  { id: "T-0757", date: "2025-06-05", category: "warehouse-services", memo: "net-30 payment", amountCents: 6644 },
  { id: "T-0758", date: "2025-03-16", category: "warehouse-services", memo: "expense report", amountCents: 46526 },
  { id: "T-0759", date: "2025-02-16", category: "lab-supplies", memo: "expense report", amountCents: 10962 },
  { id: "T-0760", date: "2025-01-07", category: "lab-maintenance", memo: "expense report", amountCents: 33997 },
  { id: "T-0761", date: "2025-01-08", category: "training-supplies", memo: "bulk order", amountCents: 26955 },
  { id: "T-0762", date: "2025-05-21", category: "events-services", memo: "bulk order", amountCents: 2254 },
  { id: "T-0763", date: "2025-06-19", category: "retail-supplies", memo: "restock order", amountCents: 15070 },
  { id: "T-0764", date: "2025-03-22", category: "retail-equipment", memo: "one-off purchase", amountCents: 87923 },
  { id: "T-0765", date: "2025-06-01", category: "marketing-supplies", memo: "recurring charge", amountCents: 51291 },
  { id: "T-0766", date: "2025-04-17", category: "fleet-services", memo: "emergency replacement", amountCents: 62449 },
  { id: "T-0767", date: "2025-05-19", category: "training-supplies", memo: "quarterly invoice", amountCents: 53484 },
  { id: "T-0768", date: "2025-01-17", category: "field-maintenance", memo: "net-30 payment", amountCents: 21747 },
  { id: "T-0769", date: "2025-04-24", category: "field-supplies", memo: "contract renewal", amountCents: 71174 },
  { id: "T-0770", date: "2025-01-22", category: "marketing-maintenance", memo: "emergency replacement", amountCents: 58463 },
  { id: "T-0771", date: "2025-03-28", category: "lab-services", memo: "one-off purchase", amountCents: 78198 },
  { id: "T-0772", date: "2025-06-27", category: "events-supplies", memo: "contract renewal", amountCents: 87228 },
  { id: "T-0773", date: "2025-02-26", category: "lab-supplies", memo: "restock order", amountCents: 47856 },
  { id: "T-0774", date: "2025-04-12", category: "training-supplies", memo: "emergency replacement", amountCents: 97207 },
  { id: "T-0775", date: "2025-06-21", category: "events-maintenance", memo: "contract renewal", amountCents: 70717 },
  { id: "T-0776", date: "2025-04-25", category: "facilities-maintenance", memo: "quarterly invoice", amountCents: 84235 },
  { id: "T-0777", date: "2025-04-13", category: "facilities-equipment", memo: "expense report", amountCents: 38062 },
  { id: "T-0778", date: "2025-05-05", category: "training-equipment", memo: "recurring charge", amountCents: 98630 },
  { id: "T-0779", date: "2025-06-04", category: "vendor-maintenance", memo: "recurring charge", amountCents: 97147 },
  { id: "T-0780", date: "2025-03-24", category: "events-maintenance", memo: "restock order", amountCents: 58771 },
  { id: "T-0781", date: "2025-03-04", category: "events-supplies", memo: "contract renewal", amountCents: 30685 },
  { id: "T-0782", date: "2025-01-26", category: "retail-supplies", memo: "emergency replacement", amountCents: 62366 },
  { id: "T-0783", date: "2025-01-13", category: "studio-supplies", memo: "purchase order", amountCents: 70963 },
  { id: "T-0784", date: "2025-01-22", category: "facilities-equipment", memo: "one-off purchase", amountCents: 20430 },
  { id: "T-0785", date: "2025-02-26", category: "lab-supplies", memo: "restock order", amountCents: 40582 },
  { id: "T-0786", date: "2025-01-11", category: "facilities-equipment", memo: "restock order", amountCents: 26453 },
  { id: "T-0787", date: "2025-01-14", category: "lab-supplies", memo: "net-30 payment", amountCents: 23054 },
  { id: "T-0788", date: "2025-01-26", category: "fleet-services", memo: "net-30 payment", amountCents: 86663 },
  { id: "T-0789", date: "2025-01-23", category: "field-services", memo: "one-off purchase", amountCents: 99456 },
  { id: "T-0790", date: "2025-04-16", category: "training-equipment", memo: "purchase order", amountCents: 35764 },
  { id: "T-0791", date: "2025-01-19", category: "field-supplies", memo: "reimbursement", amountCents: 77039 },
  { id: "T-0792", date: "2025-06-26", category: "retail-maintenance", memo: "bulk order", amountCents: 78604 },
  { id: "T-0793", date: "2025-06-01", category: "retail-maintenance", memo: "service call", amountCents: 77993 },
  { id: "T-0794", date: "2025-01-04", category: "training-maintenance", memo: "reimbursement", amountCents: 77983 },
  { id: "T-0795", date: "2025-05-28", category: "facilities-equipment", memo: "net-30 payment", amountCents: 56445 },
  { id: "T-0796", date: "2025-06-05", category: "studio-equipment", memo: "reimbursement", amountCents: 51613 },
  { id: "T-0797", date: "2025-03-14", category: "warehouse-maintenance", memo: "net-30 payment", amountCents: 65973 },
  { id: "T-0798", date: "2025-05-03", category: "fleet-maintenance", memo: "reimbursement", amountCents: 59825 },
  { id: "T-0799", date: "2025-01-07", category: "retail-supplies", memo: "one-off purchase", amountCents: 81315 },
  { id: "T-0800", date: "2025-05-06", category: "studio-supplies", memo: "quarterly invoice", amountCents: 3520 },
  { id: "T-0801", date: "2025-05-26", category: "office-maintenance", memo: "service call", amountCents: 28465 },
  { id: "T-0802", date: "2025-02-17", category: "fleet-services", memo: "purchase order", amountCents: 68150 },
  { id: "T-0803", date: "2025-02-10", category: "lab-supplies", memo: "one-off purchase", amountCents: 38782 },
  { id: "T-0804", date: "2025-04-17", category: "retail-maintenance", memo: "purchase order", amountCents: 92266 },
  { id: "T-0805", date: "2025-03-15", category: "facilities-equipment", memo: "restock order", amountCents: 5606 },
  { id: "T-0806", date: "2025-04-07", category: "studio-services", memo: "service call", amountCents: 69687 },
  { id: "T-0807", date: "2025-04-23", category: "lab-services", memo: "restock order", amountCents: 49080 },
  { id: "T-0808", date: "2025-06-25", category: "events-services", memo: "one-off purchase", amountCents: 80874 },
  { id: "T-0809", date: "2025-03-27", category: "retail-services", memo: "quarterly invoice", amountCents: 64606 },
  { id: "T-0810", date: "2025-06-17", category: "vendor-services", memo: "restock order", amountCents: 22675 },
  { id: "T-0811", date: "2025-05-09", category: "lab-services", memo: "reimbursement", amountCents: 52356 },
  { id: "T-0812", date: "2025-03-15", category: "events-supplies", memo: "recurring charge", amountCents: 58764 },
  { id: "T-0813", date: "2025-03-14", category: "marketing-services", memo: "restock order", amountCents: 9982 },
  { id: "T-0814", date: "2025-06-09", category: "vendor-maintenance", memo: "service call", amountCents: 68351 },
  { id: "T-0815", date: "2025-04-23", category: "training-services", memo: "restock order", amountCents: 37359 },
  { id: "T-0816", date: "2025-04-18", category: "retail-services", memo: "service call", amountCents: 92777 },
  { id: "T-0817", date: "2025-03-20", category: "field-maintenance", memo: "one-off purchase", amountCents: 3989 },
  { id: "T-0818", date: "2025-05-02", category: "facilities-equipment", memo: "one-off purchase", amountCents: 79108 },
  { id: "T-0819", date: "2025-02-26", category: "field-services", memo: "service call", amountCents: 66855 },
  { id: "T-0820", date: "2025-05-18", category: "field-equipment", memo: "recurring charge", amountCents: 44793 },
  { id: "T-0821", date: "2025-04-02", category: "field-services", memo: "purchase order", amountCents: 71506 },
  { id: "T-0822", date: "2025-03-28", category: "warehouse-services", memo: "restock order", amountCents: 82689 },
  { id: "T-0823", date: "2025-02-15", category: "office-maintenance", memo: "net-30 payment", amountCents: 79080 },
  { id: "T-0824", date: "2025-06-24", category: "fleet-supplies", memo: "recurring charge", amountCents: 59723 },
  { id: "T-0825", date: "2025-02-26", category: "marketing-equipment", memo: "recurring charge", amountCents: 50955 },
  { id: "T-0826", date: "2025-06-19", category: "field-services", memo: "restock order", amountCents: 42435 },
  { id: "T-0827", date: "2025-05-15", category: "field-supplies", memo: "purchase order", amountCents: 56540 },
  { id: "T-0828", date: "2025-01-03", category: "vendor-services", memo: "one-off purchase", amountCents: 39189 },
  { id: "T-0829", date: "2025-02-24", category: "marketing-supplies", memo: "emergency replacement", amountCents: 44321 },
  { id: "T-0830", date: "2025-02-05", category: "studio-supplies", memo: "reimbursement", amountCents: 76686 },
  { id: "T-0831", date: "2025-05-28", category: "office-maintenance", memo: "purchase order", amountCents: 81312 },
  { id: "T-0832", date: "2025-06-11", category: "field-services", memo: "reimbursement", amountCents: 97568 },
  { id: "T-0833", date: "2025-05-13", category: "fleet-supplies", memo: "reimbursement", amountCents: 80758 },
  { id: "T-0834", date: "2025-01-24", category: "lab-equipment", memo: "bulk order", amountCents: 93416 },
  { id: "T-0835", date: "2025-04-04", category: "vendor-maintenance", memo: "restock order", amountCents: 37549 },
  { id: "T-0836", date: "2025-02-16", category: "fleet-supplies", memo: "expense report", amountCents: 38440 },
  { id: "T-0837", date: "2025-03-24", category: "retail-maintenance", memo: "restock order", amountCents: 32510 },
  { id: "T-0838", date: "2025-05-05", category: "warehouse-equipment", memo: "service call", amountCents: 3179 },
  { id: "T-0839", date: "2025-01-02", category: "retail-equipment", memo: "purchase order", amountCents: 15891 },
  { id: "T-0840", date: "2025-03-28", category: "fleet-services", memo: "one-off purchase", amountCents: 4431 },
  { id: "T-0841", date: "2025-04-08", category: "studio-maintenance", memo: "recurring charge", amountCents: 87242 },
  { id: "T-0842", date: "2025-02-05", category: "field-supplies", memo: "contract renewal", amountCents: 96699 },
  { id: "T-0843", date: "2025-05-07", category: "office-equipment", memo: "service call", amountCents: 64644 },
  { id: "T-0844", date: "2025-06-19", category: "warehouse-equipment", memo: "purchase order", amountCents: 50119 },
  { id: "T-0845", date: "2025-04-08", category: "lab-maintenance", memo: "expense report", amountCents: 87269 },
  { id: "T-0846", date: "2025-05-13", category: "events-equipment", memo: "emergency replacement", amountCents: 56011 },
  { id: "T-0847", date: "2025-03-02", category: "retail-services", memo: "quarterly invoice", amountCents: 93057 },
  { id: "T-0848", date: "2025-03-01", category: "training-maintenance", memo: "quarterly invoice", amountCents: 14425 },
  { id: "T-0849", date: "2025-02-02", category: "warehouse-equipment", memo: "reimbursement", amountCents: 32081 },
  { id: "T-0850", date: "2025-05-21", category: "fleet-maintenance", memo: "restock order", amountCents: 85523 },
  { id: "T-0851", date: "2025-03-01", category: "events-supplies", memo: "one-off purchase", amountCents: 22570 },
  { id: "T-0852", date: "2025-02-01", category: "marketing-equipment", memo: "restock order", amountCents: 56901 },
  { id: "T-0853", date: "2025-06-17", category: "office-supplies", memo: "service call", amountCents: 40202 },
  { id: "T-0854", date: "2025-03-20", category: "office-equipment", memo: "contract renewal", amountCents: 15619 },
  { id: "T-0855", date: "2025-04-21", category: "field-maintenance", memo: "one-off purchase", amountCents: 93265 },
  { id: "T-0856", date: "2025-06-18", category: "field-services", memo: "bulk order", amountCents: 10732 },
  { id: "T-0857", date: "2025-03-13", category: "warehouse-maintenance", memo: "service call", amountCents: 18106 },
  { id: "T-0858", date: "2025-05-27", category: "office-services", memo: "expense report", amountCents: 83443 },
  { id: "T-0859", date: "2025-02-04", category: "lab-supplies", memo: "contract renewal", amountCents: 92005 },
  { id: "T-0860", date: "2025-01-26", category: "facilities-services", memo: "quarterly invoice", amountCents: 70017 },
  { id: "T-0861", date: "2025-01-06", category: "field-equipment", memo: "net-30 payment", amountCents: 85592 },
  { id: "T-0862", date: "2025-01-14", category: "retail-equipment", memo: "bulk order", amountCents: 51234 },
  { id: "T-0863", date: "2025-01-04", category: "events-supplies", memo: "bulk order", amountCents: 47270 },
  { id: "T-0864", date: "2025-05-05", category: "vendor-equipment", memo: "emergency replacement", amountCents: 54199 },
  { id: "T-0865", date: "2025-05-07", category: "lab-equipment", memo: "restock order", amountCents: 12803 },
  { id: "T-0866", date: "2025-01-16", category: "lab-supplies", memo: "contract renewal", amountCents: 13545 },
  { id: "T-0867", date: "2025-03-28", category: "studio-services", memo: "emergency replacement", amountCents: 21342 },
  { id: "T-0868", date: "2025-06-18", category: "vendor-supplies", memo: "purchase order", amountCents: 89435 },
  { id: "T-0869", date: "2025-03-27", category: "warehouse-supplies", memo: "one-off purchase", amountCents: 32823 },
  { id: "T-0870", date: "2025-05-09", category: "warehouse-supplies", memo: "service call", amountCents: 83670 },
  { id: "T-0871", date: "2025-04-13", category: "studio-services", memo: "expense report", amountCents: 59127 },
  { id: "T-0872", date: "2025-06-02", category: "facilities-services", memo: "restock order", amountCents: 92558 },
  { id: "T-0873", date: "2025-06-18", category: "vendor-supplies", memo: "one-off purchase", amountCents: 54041 },
  { id: "T-0874", date: "2025-06-28", category: "events-supplies", memo: "bulk order", amountCents: 56155 },
  { id: "T-0875", date: "2025-01-25", category: "studio-equipment", memo: "contract renewal", amountCents: 65471 },
  { id: "T-0876", date: "2025-03-12", category: "vendor-services", memo: "net-30 payment", amountCents: 51742 },
  { id: "T-0877", date: "2025-05-23", category: "field-maintenance", memo: "one-off purchase", amountCents: 65724 },
  { id: "T-0878", date: "2025-02-13", category: "facilities-supplies", memo: "reimbursement", amountCents: 64833 },
  { id: "T-0879", date: "2025-01-14", category: "events-equipment", memo: "one-off purchase", amountCents: 24271 },
  { id: "T-0880", date: "2025-06-20", category: "field-services", memo: "net-30 payment", amountCents: 32356 },
  { id: "T-0881", date: "2025-01-19", category: "warehouse-equipment", memo: "quarterly invoice", amountCents: 90289 },
  { id: "T-0882", date: "2025-06-14", category: "training-equipment", memo: "bulk order", amountCents: 5364 },
  { id: "T-0883", date: "2025-04-01", category: "training-equipment", memo: "contract renewal", amountCents: 73898 },
  { id: "T-0884", date: "2025-04-28", category: "facilities-supplies", memo: "emergency replacement", amountCents: 571 },
  { id: "T-0885", date: "2025-05-01", category: "field-maintenance", memo: "bulk order", amountCents: 12414 },
  { id: "T-0886", date: "2025-06-14", category: "fleet-services", memo: "reimbursement", amountCents: 6385 },
  { id: "T-0887", date: "2025-03-27", category: "fleet-equipment", memo: "net-30 payment", amountCents: 76581 },
  { id: "T-0888", date: "2025-04-25", category: "events-maintenance", memo: "bulk order", amountCents: 79450 },
  { id: "T-0889", date: "2025-04-15", category: "facilities-equipment", memo: "expense report", amountCents: 63569 },
  { id: "T-0890", date: "2025-05-06", category: "facilities-services", memo: "restock order", amountCents: 93796 },
  { id: "T-0891", date: "2025-06-20", category: "events-supplies", memo: "recurring charge", amountCents: 94018 },
  { id: "T-0892", date: "2025-03-20", category: "vendor-services", memo: "bulk order", amountCents: 47580 },
  { id: "T-0893", date: "2025-04-04", category: "facilities-equipment", memo: "service call", amountCents: 97419 },
  { id: "T-0894", date: "2025-06-19", category: "facilities-maintenance", memo: "recurring charge", amountCents: 95396 },
  { id: "T-0895", date: "2025-06-24", category: "office-equipment", memo: "expense report", amountCents: 21067 },
  { id: "T-0896", date: "2025-06-02", category: "marketing-equipment", memo: "service call", amountCents: 46522 },
  { id: "T-0897", date: "2025-06-07", category: "vendor-supplies", memo: "net-30 payment", amountCents: 37980 },
  { id: "T-0898", date: "2025-03-21", category: "retail-services", memo: "purchase order", amountCents: 77281 },
  { id: "T-0899", date: "2025-04-05", category: "facilities-equipment", memo: "expense report", amountCents: 42988 },
  { id: "T-0900", date: "2025-06-11", category: "field-maintenance", memo: "service call", amountCents: 12853 },
  { id: "T-0901", date: "2025-06-20", category: "facilities-maintenance", memo: "bulk order", amountCents: 4790 },
  { id: "T-0902", date: "2025-02-22", category: "office-equipment", memo: "bulk order", amountCents: 93519 },
  { id: "T-0903", date: "2025-03-04", category: "vendor-maintenance", memo: "service call", amountCents: 50152 },
  { id: "T-0904", date: "2025-02-02", category: "warehouse-supplies", memo: "reimbursement", amountCents: 48485 },
  { id: "T-0905", date: "2025-06-03", category: "vendor-services", memo: "service call", amountCents: 70246 },
  { id: "T-0906", date: "2025-01-27", category: "office-maintenance", memo: "bulk order", amountCents: 38990 },
  { id: "T-0907", date: "2025-03-02", category: "studio-supplies", memo: "recurring charge", amountCents: 36460 },
  { id: "T-0908", date: "2025-05-11", category: "retail-equipment", memo: "service call", amountCents: 48223 },
  { id: "T-0909", date: "2025-02-28", category: "events-supplies", memo: "quarterly invoice", amountCents: 25023 },
  { id: "T-0910", date: "2025-04-22", category: "marketing-supplies", memo: "net-30 payment", amountCents: 2182 },
  { id: "T-0911", date: "2025-01-02", category: "vendor-services", memo: "recurring charge", amountCents: 17061 },
  { id: "T-0912", date: "2025-06-06", category: "fleet-services", memo: "bulk order", amountCents: 15071 },
  { id: "T-0913", date: "2025-01-16", category: "facilities-supplies", memo: "restock order", amountCents: 75592 },
  { id: "T-0914", date: "2025-05-21", category: "vendor-supplies", memo: "recurring charge", amountCents: 12854 },
  { id: "T-0915", date: "2025-02-12", category: "fleet-equipment", memo: "bulk order", amountCents: 65002 },
  { id: "T-0916", date: "2025-05-11", category: "training-equipment", memo: "emergency replacement", amountCents: 89986 },
  { id: "T-0917", date: "2025-05-18", category: "lab-services", memo: "quarterly invoice", amountCents: 12556 },
  { id: "T-0918", date: "2025-04-18", category: "office-services", memo: "purchase order", amountCents: 5400 },
  { id: "T-0919", date: "2025-03-21", category: "office-equipment", memo: "bulk order", amountCents: 78670 },
  { id: "T-0920", date: "2025-04-18", category: "studio-maintenance", memo: "emergency replacement", amountCents: 95938 },
  { id: "T-0921", date: "2025-05-28", category: "vendor-equipment", memo: "recurring charge", amountCents: 63420 },
  { id: "T-0922", date: "2025-05-21", category: "retail-supplies", memo: "purchase order", amountCents: 51874 },
  { id: "T-0923", date: "2025-01-04", category: "warehouse-supplies", memo: "bulk order", amountCents: 56552 },
  { id: "T-0924", date: "2025-01-22", category: "studio-services", memo: "service call", amountCents: 38277 },
  { id: "T-0925", date: "2025-01-18", category: "events-equipment", memo: "one-off purchase", amountCents: 31132 },
  { id: "T-0926", date: "2025-02-11", category: "studio-services", memo: "restock order", amountCents: 71238 },
  { id: "T-0927", date: "2025-03-01", category: "facilities-maintenance", memo: "bulk order", amountCents: 73589 },
  { id: "T-0928", date: "2025-04-09", category: "lab-services", memo: "one-off purchase", amountCents: 67626 },
  { id: "T-0929", date: "2025-06-04", category: "retail-supplies", memo: "purchase order", amountCents: 84439 },
  { id: "T-0930", date: "2025-02-23", category: "warehouse-services", memo: "reimbursement", amountCents: 57970 },
  { id: "T-0931", date: "2025-05-01", category: "warehouse-supplies", memo: "quarterly invoice", amountCents: 89302 },
  { id: "T-0932", date: "2025-01-25", category: "studio-supplies", memo: "contract renewal", amountCents: 24999 },
  { id: "T-0933", date: "2025-04-12", category: "warehouse-supplies", memo: "net-30 payment", amountCents: 30158 },
  { id: "T-0934", date: "2025-05-03", category: "field-maintenance", memo: "bulk order", amountCents: 36134 },
  { id: "T-0935", date: "2025-04-01", category: "field-services", memo: "quarterly invoice", amountCents: 69837 },
  { id: "T-0936", date: "2025-02-26", category: "office-maintenance", memo: "contract renewal", amountCents: 26640 },
  { id: "T-0937", date: "2025-01-10", category: "warehouse-supplies", memo: "contract renewal", amountCents: 31028 },
  { id: "T-0938", date: "2025-03-13", category: "facilities-supplies", memo: "quarterly invoice", amountCents: 46698 },
  { id: "T-0939", date: "2025-06-06", category: "fleet-maintenance", memo: "reimbursement", amountCents: 71718 },
  { id: "T-0940", date: "2025-06-13", category: "field-services", memo: "reimbursement", amountCents: 68485 },
  { id: "T-0941", date: "2025-04-14", category: "training-equipment", memo: "emergency replacement", amountCents: 93173 },
  { id: "T-0942", date: "2025-01-08", category: "office-maintenance", memo: "recurring charge", amountCents: 35705 },
  { id: "T-0943", date: "2025-06-21", category: "marketing-services", memo: "bulk order", amountCents: 6667 },
  { id: "T-0944", date: "2025-04-12", category: "marketing-equipment", memo: "recurring charge", amountCents: 4216 },
  { id: "T-0945", date: "2025-03-10", category: "lab-equipment", memo: "service call", amountCents: 42148 },
  { id: "T-0946", date: "2025-03-08", category: "studio-supplies", memo: "emergency replacement", amountCents: 13644 },
  { id: "T-0947", date: "2025-05-01", category: "field-supplies", memo: "expense report", amountCents: 36664 },
  { id: "T-0948", date: "2025-03-27", category: "retail-services", memo: "contract renewal", amountCents: 9935 },
  { id: "T-0949", date: "2025-03-22", category: "training-maintenance", memo: "restock order", amountCents: 50010 },
  { id: "T-0950", date: "2025-02-15", category: "retail-maintenance", memo: "purchase order", amountCents: 80729 },
  { id: "T-0951", date: "2025-02-13", category: "training-maintenance", memo: "net-30 payment", amountCents: 69154 },
  { id: "T-0952", date: "2025-04-26", category: "lab-equipment", memo: "one-off purchase", amountCents: 14037 },
  { id: "T-0953", date: "2025-03-15", category: "office-services", memo: "quarterly invoice", amountCents: 90129 },
  { id: "T-0954", date: "2025-06-22", category: "fleet-maintenance", memo: "recurring charge", amountCents: 89900 },
  { id: "T-0955", date: "2025-05-10", category: "training-services", memo: "recurring charge", amountCents: 52134 },
  { id: "T-0956", date: "2025-02-11", category: "field-services", memo: "purchase order", amountCents: 46250 },
  { id: "T-0957", date: "2025-05-22", category: "field-equipment", memo: "contract renewal", amountCents: 62493 },
  { id: "T-0958", date: "2025-01-27", category: "lab-equipment", memo: "quarterly invoice", amountCents: 84288 },
  { id: "T-0959", date: "2025-05-22", category: "vendor-services", memo: "expense report", amountCents: 19620 },
  { id: "T-0960", date: "2025-04-23", category: "fleet-supplies", memo: "restock order", amountCents: 63352 },
  { id: "T-0961", date: "2025-05-06", category: "events-supplies", memo: "net-30 payment", amountCents: 58445 },
  { id: "T-0962", date: "2025-06-25", category: "fleet-maintenance", memo: "service call", amountCents: 61886 },
  { id: "T-0963", date: "2025-04-24", category: "retail-maintenance", memo: "reimbursement", amountCents: 69683 },
  { id: "T-0964", date: "2025-01-27", category: "fleet-equipment", memo: "bulk order", amountCents: 64970 },
  { id: "T-0965", date: "2025-03-13", category: "fleet-equipment", memo: "purchase order", amountCents: 32297 },
  { id: "T-0966", date: "2025-05-17", category: "warehouse-services", memo: "emergency replacement", amountCents: 62272 },
  { id: "T-0967", date: "2025-01-15", category: "warehouse-maintenance", memo: "one-off purchase", amountCents: 99268 },
  { id: "T-0968", date: "2025-06-05", category: "events-maintenance", memo: "contract renewal", amountCents: 83358 },
  { id: "T-0969", date: "2025-04-15", category: "office-maintenance", memo: "reimbursement", amountCents: 63710 },
  { id: "T-0970", date: "2025-01-14", category: "field-equipment", memo: "restock order", amountCents: 90952 },
  { id: "T-0971", date: "2025-03-01", category: "retail-services", memo: "purchase order", amountCents: 19327 },
  { id: "T-0972", date: "2025-06-26", category: "fleet-supplies", memo: "bulk order", amountCents: 64226 },
  { id: "T-0973", date: "2025-04-11", category: "office-maintenance", memo: "bulk order", amountCents: 29421 },
  { id: "T-0974", date: "2025-03-01", category: "marketing-maintenance", memo: "quarterly invoice", amountCents: 92344 },
  { id: "T-0975", date: "2025-04-10", category: "warehouse-supplies", memo: "emergency replacement", amountCents: 87941 },
  { id: "T-0976", date: "2025-06-17", category: "training-supplies", memo: "contract renewal", amountCents: 37509 },
  { id: "T-0977", date: "2025-06-10", category: "field-equipment", memo: "one-off purchase", amountCents: 55103 },
  { id: "T-0978", date: "2025-04-02", category: "facilities-equipment", memo: "bulk order", amountCents: 24539 },
  { id: "T-0979", date: "2025-01-15", category: "studio-equipment", memo: "contract renewal", amountCents: 80723 },
  { id: "T-0980", date: "2025-01-07", category: "retail-equipment", memo: "net-30 payment", amountCents: 60467 },
  { id: "T-0981", date: "2025-05-08", category: "studio-services", memo: "purchase order", amountCents: 99472 },
  { id: "T-0982", date: "2025-05-02", category: "warehouse-supplies", memo: "restock order", amountCents: 6547 },
  { id: "T-0983", date: "2025-01-09", category: "lab-equipment", memo: "recurring charge", amountCents: 96755 },
  { id: "T-0984", date: "2025-01-09", category: "office-supplies", memo: "one-off purchase", amountCents: 16040 },
  { id: "T-0985", date: "2025-05-26", category: "office-maintenance", memo: "bulk order", amountCents: 55292 },
  { id: "T-0986", date: "2025-06-14", category: "retail-supplies", memo: "reimbursement", amountCents: 93978 },
  { id: "T-0987", date: "2025-06-23", category: "vendor-maintenance", memo: "restock order", amountCents: 7867 },
  { id: "T-0988", date: "2025-02-06", category: "marketing-maintenance", memo: "contract renewal", amountCents: 45704 },
  { id: "T-0989", date: "2025-05-03", category: "marketing-supplies", memo: "emergency replacement", amountCents: 67305 },
  { id: "T-0990", date: "2025-05-05", category: "events-supplies", memo: "expense report", amountCents: 81952 },
  { id: "T-0991", date: "2025-03-19", category: "warehouse-equipment", memo: "recurring charge", amountCents: 40564 },
  { id: "T-0992", date: "2025-04-14", category: "facilities-supplies", memo: "net-30 payment", amountCents: 80914 },
  { id: "T-0993", date: "2025-02-06", category: "warehouse-maintenance", memo: "quarterly invoice", amountCents: 32407 },
  { id: "T-0994", date: "2025-02-06", category: "fleet-supplies", memo: "purchase order", amountCents: 52817 },
  { id: "T-0995", date: "2025-03-03", category: "field-equipment", memo: "one-off purchase", amountCents: 92560 },
  { id: "T-0996", date: "2025-04-27", category: "studio-equipment", memo: "bulk order", amountCents: 27114 },
  { id: "T-0997", date: "2025-02-09", category: "vendor-supplies", memo: "restock order", amountCents: 11239 },
  { id: "T-0998", date: "2025-04-25", category: "fleet-services", memo: "purchase order", amountCents: 77728 },
  { id: "T-0999", date: "2025-02-02", category: "lab-equipment", memo: "reimbursement", amountCents: 74850 },
  { id: "T-1000", date: "2025-06-07", category: "vendor-maintenance", memo: "purchase order", amountCents: 12829 },
  { id: "T-1001", date: "2025-03-03", category: "marketing-equipment", memo: "quarterly invoice", amountCents: 40543 },
  { id: "T-1002", date: "2025-04-26", category: "warehouse-maintenance", memo: "one-off purchase", amountCents: 34499 },
  { id: "T-1003", date: "2025-05-01", category: "lab-services", memo: "recurring charge", amountCents: 25208 },
  { id: "T-1004", date: "2025-01-20", category: "office-services", memo: "service call", amountCents: 98600 },
  { id: "T-1005", date: "2025-02-11", category: "lab-maintenance", memo: "net-30 payment", amountCents: 4236 },
  { id: "T-1006", date: "2025-03-26", category: "fleet-equipment", memo: "contract renewal", amountCents: 51940 },
  { id: "T-1007", date: "2025-04-20", category: "studio-services", memo: "recurring charge", amountCents: 88880 },
  { id: "T-1008", date: "2025-02-09", category: "field-equipment", memo: "net-30 payment", amountCents: 81896 },
  { id: "T-1009", date: "2025-01-24", category: "marketing-services", memo: "one-off purchase", amountCents: 4078 },
  { id: "T-1010", date: "2025-03-06", category: "facilities-maintenance", memo: "net-30 payment", amountCents: 97265 },
  { id: "T-1011", date: "2025-05-11", category: "warehouse-equipment", memo: "quarterly invoice", amountCents: 71605 },
  { id: "T-1012", date: "2025-04-21", category: "retail-supplies", memo: "purchase order", amountCents: 1414 },
  { id: "T-1013", date: "2025-05-04", category: "marketing-services", memo: "reimbursement", amountCents: 98494 },
  { id: "T-1014", date: "2025-03-19", category: "warehouse-maintenance", memo: "recurring charge", amountCents: 90540 },
  { id: "T-1015", date: "2025-01-01", category: "facilities-maintenance", memo: "recurring charge", amountCents: 7660 },
  { id: "T-1016", date: "2025-01-21", category: "retail-services", memo: "restock order", amountCents: 32360 },
  { id: "T-1017", date: "2025-03-11", category: "studio-services", memo: "contract renewal", amountCents: 54684 },
  { id: "T-1018", date: "2025-06-28", category: "office-maintenance", memo: "net-30 payment", amountCents: 68947 },
  { id: "T-1019", date: "2025-02-01", category: "marketing-maintenance", memo: "purchase order", amountCents: 35895 },
  { id: "T-1020", date: "2025-04-23", category: "events-equipment", memo: "service call", amountCents: 12460 },
  { id: "T-1021", date: "2025-01-23", category: "office-supplies", memo: "service call", amountCents: 18545 },
  { id: "T-1022", date: "2025-06-15", category: "training-services", memo: "one-off purchase", amountCents: 27774 },
  { id: "T-1023", date: "2025-02-25", category: "retail-equipment", memo: "emergency replacement", amountCents: 86018 },
  { id: "T-1024", date: "2025-05-08", category: "vendor-maintenance", memo: "service call", amountCents: 62375 },
  { id: "T-1025", date: "2025-01-04", category: "studio-maintenance", memo: "reimbursement", amountCents: 50144 },
  { id: "T-1026", date: "2025-01-11", category: "field-equipment", memo: "expense report", amountCents: 46712 },
  { id: "T-1027", date: "2025-04-26", category: "marketing-supplies", memo: "purchase order", amountCents: 18139 },
  { id: "T-1028", date: "2025-01-25", category: "studio-maintenance", memo: "restock order", amountCents: 95033 },
  { id: "T-1029", date: "2025-02-12", category: "training-equipment", memo: "contract renewal", amountCents: 40218 },
  { id: "T-1030", date: "2025-05-27", category: "fleet-services", memo: "emergency replacement", amountCents: 44607 },
  { id: "T-1031", date: "2025-04-28", category: "office-supplies", memo: "bulk order", amountCents: 42382 },
  { id: "T-1032", date: "2025-02-19", category: "vendor-supplies", memo: "service call", amountCents: 86027 },
  { id: "T-1033", date: "2025-04-03", category: "marketing-supplies", memo: "restock order", amountCents: 26424 },
  { id: "T-1034", date: "2025-02-26", category: "lab-equipment", memo: "one-off purchase", amountCents: 68133 },
  { id: "T-1035", date: "2025-02-27", category: "training-services", memo: "contract renewal", amountCents: 6490 },
  { id: "T-1036", date: "2025-05-25", category: "marketing-equipment", memo: "one-off purchase", amountCents: 78159 },
  { id: "T-1037", date: "2025-03-23", category: "fleet-supplies", memo: "bulk order", amountCents: 88489 },
  { id: "T-1038", date: "2025-05-28", category: "office-services", memo: "one-off purchase", amountCents: 85311 },
  { id: "T-1039", date: "2025-06-17", category: "warehouse-supplies", memo: "expense report", amountCents: 12300 },
  { id: "T-1040", date: "2025-03-02", category: "warehouse-maintenance", memo: "quarterly invoice", amountCents: 27752 },
  { id: "T-1041", date: "2025-04-02", category: "facilities-services", memo: "one-off purchase", amountCents: 22326 },
  { id: "T-1042", date: "2025-06-21", category: "warehouse-maintenance", memo: "net-30 payment", amountCents: 97959 },
  { id: "T-1043", date: "2025-06-12", category: "training-equipment", memo: "restock order", amountCents: 29138 },
  { id: "T-1044", date: "2025-01-18", category: "office-equipment", memo: "quarterly invoice", amountCents: 85674 },
  { id: "T-1045", date: "2025-03-20", category: "field-maintenance", memo: "one-off purchase", amountCents: 743 },
  { id: "T-1046", date: "2025-04-26", category: "lab-equipment", memo: "restock order", amountCents: 29266 },
  { id: "T-1047", date: "2025-01-11", category: "events-supplies", memo: "net-30 payment", amountCents: 9792 },
  { id: "T-1048", date: "2025-03-19", category: "facilities-equipment", memo: "emergency replacement", amountCents: 52732 },
  { id: "T-1049", date: "2025-04-03", category: "field-services", memo: "bulk order", amountCents: 2426 },
  { id: "T-1050", date: "2025-03-02", category: "lab-maintenance", memo: "quarterly invoice", amountCents: 48589 },
  { id: "T-1051", date: "2025-04-21", category: "warehouse-services", memo: "purchase order", amountCents: 78208 },
  { id: "T-1052", date: "2025-06-27", category: "training-maintenance", memo: "bulk order", amountCents: 58417 },
  { id: "T-1053", date: "2025-05-12", category: "vendor-maintenance", memo: "service call", amountCents: 95263 },
  { id: "T-1054", date: "2025-03-21", category: "warehouse-equipment", memo: "one-off purchase", amountCents: 80385 },
  { id: "T-1055", date: "2025-02-11", category: "events-supplies", memo: "expense report", amountCents: 1857 },
  { id: "T-1056", date: "2025-02-14", category: "events-supplies", memo: "recurring charge", amountCents: 82782 },
  { id: "T-1057", date: "2025-02-27", category: "lab-services", memo: "reimbursement", amountCents: 29834 },
  { id: "T-1058", date: "2025-04-19", category: "field-services", memo: "purchase order", amountCents: 15896 },
  { id: "T-1059", date: "2025-02-25", category: "vendor-services", memo: "purchase order", amountCents: 26341 },
  { id: "T-1060", date: "2025-02-19", category: "retail-services", memo: "expense report", amountCents: 46634 },
  { id: "T-1061", date: "2025-06-11", category: "retail-supplies", memo: "net-30 payment", amountCents: 67837 },
  { id: "T-1062", date: "2025-05-27", category: "studio-supplies", memo: "net-30 payment", amountCents: 56608 },
  { id: "T-1063", date: "2025-05-12", category: "retail-services", memo: "contract renewal", amountCents: 99496 },
  { id: "T-1064", date: "2025-06-16", category: "warehouse-services", memo: "expense report", amountCents: 45901 },
  { id: "T-1065", date: "2025-02-19", category: "field-equipment", memo: "contract renewal", amountCents: 65669 },
  { id: "T-1066", date: "2025-02-17", category: "studio-supplies", memo: "bulk order", amountCents: 43306 },
  { id: "T-1067", date: "2025-02-09", category: "training-services", memo: "expense report", amountCents: 80528 },
  { id: "T-1068", date: "2025-02-22", category: "training-maintenance", memo: "purchase order", amountCents: 36279 },
  { id: "T-1069", date: "2025-05-02", category: "field-supplies", memo: "contract renewal", amountCents: 89025 },
  { id: "T-1070", date: "2025-04-08", category: "field-services", memo: "restock order", amountCents: 47055 },
  { id: "T-1071", date: "2025-06-24", category: "fleet-maintenance", memo: "bulk order", amountCents: 53800 },
  { id: "T-1072", date: "2025-01-16", category: "fleet-maintenance", memo: "restock order", amountCents: 7907 },
  { id: "T-1073", date: "2025-03-18", category: "vendor-maintenance", memo: "service call", amountCents: 89888 },
  { id: "T-1074", date: "2025-02-07", category: "retail-maintenance", memo: "contract renewal", amountCents: 73596 },
  { id: "T-1075", date: "2025-01-10", category: "warehouse-services", memo: "net-30 payment", amountCents: 42832 },
  { id: "T-1076", date: "2025-05-14", category: "marketing-equipment", memo: "net-30 payment", amountCents: 70159 },
  { id: "T-1077", date: "2025-04-20", category: "training-supplies", memo: "one-off purchase", amountCents: 51244 },
  { id: "T-1078", date: "2025-05-02", category: "field-equipment", memo: "emergency replacement", amountCents: 37018 },
  { id: "T-1079", date: "2025-04-25", category: "office-equipment", memo: "expense report", amountCents: 16311 },
  { id: "T-1080", date: "2025-01-17", category: "lab-equipment", memo: "one-off purchase", amountCents: 94551 },
  { id: "T-1081", date: "2025-02-19", category: "vendor-equipment", memo: "service call", amountCents: 23499 },
  { id: "T-1082", date: "2025-05-01", category: "fleet-equipment", memo: "reimbursement", amountCents: 75824 },
  { id: "T-1083", date: "2025-03-25", category: "studio-services", memo: "expense report", amountCents: 38620 },
  { id: "T-1084", date: "2025-04-28", category: "field-supplies", memo: "bulk order", amountCents: 30385 },
  { id: "T-1085", date: "2025-03-08", category: "marketing-maintenance", memo: "emergency replacement", amountCents: 4795 },
  { id: "T-1086", date: "2025-06-12", category: "events-supplies", memo: "quarterly invoice", amountCents: 77767 },
  { id: "T-1087", date: "2025-02-20", category: "events-equipment", memo: "restock order", amountCents: 97300 },
  { id: "T-1088", date: "2025-03-09", category: "vendor-maintenance", memo: "expense report", amountCents: 56954 },
  { id: "T-1089", date: "2025-06-19", category: "marketing-maintenance", memo: "reimbursement", amountCents: 67210 },
  { id: "T-1090", date: "2025-02-09", category: "marketing-equipment", memo: "service call", amountCents: 4751 },
  { id: "T-1091", date: "2025-04-04", category: "events-supplies", memo: "bulk order", amountCents: 41621 },
  { id: "T-1092", date: "2025-01-15", category: "lab-maintenance", memo: "recurring charge", amountCents: 71622 },
  { id: "T-1093", date: "2025-03-05", category: "marketing-services", memo: "net-30 payment", amountCents: 76898 },
  { id: "T-1094", date: "2025-04-23", category: "lab-equipment", memo: "purchase order", amountCents: 78539 },
  { id: "T-1095", date: "2025-02-07", category: "warehouse-services", memo: "recurring charge", amountCents: 29462 },
  { id: "T-1096", date: "2025-03-19", category: "office-maintenance", memo: "contract renewal", amountCents: 49104 },
  { id: "T-1097", date: "2025-04-26", category: "warehouse-supplies", memo: "purchase order", amountCents: 51000 },
  { id: "T-1098", date: "2025-05-22", category: "lab-equipment", memo: "expense report", amountCents: 50333 },
  { id: "T-1099", date: "2025-04-24", category: "training-maintenance", memo: "bulk order", amountCents: 68915 },
  { id: "T-1100", date: "2025-01-09", category: "warehouse-maintenance", memo: "service call", amountCents: 62234 },
  { id: "T-1101", date: "2025-03-23", category: "marketing-supplies", memo: "service call", amountCents: 57720 },
  { id: "T-1102", date: "2025-02-07", category: "warehouse-services", memo: "expense report", amountCents: 21269 },
  { id: "T-1103", date: "2025-05-07", category: "warehouse-supplies", memo: "bulk order", amountCents: 93969 },
  { id: "T-1104", date: "2025-05-24", category: "lab-services", memo: "purchase order", amountCents: 50346 },
  { id: "T-1105", date: "2025-03-16", category: "marketing-maintenance", memo: "reimbursement", amountCents: 42006 },
  { id: "T-1106", date: "2025-02-12", category: "warehouse-equipment", memo: "one-off purchase", amountCents: 9902 },
  { id: "T-1107", date: "2025-04-06", category: "lab-services", memo: "reimbursement", amountCents: 6337 },
  { id: "T-1108", date: "2025-02-06", category: "lab-equipment", memo: "bulk order", amountCents: 31259 },
  { id: "T-1109", date: "2025-03-06", category: "facilities-equipment", memo: "quarterly invoice", amountCents: 33925 },
  { id: "T-1110", date: "2025-01-15", category: "lab-supplies", memo: "expense report", amountCents: 5554 },
  { id: "T-1111", date: "2025-06-25", category: "facilities-maintenance", memo: "contract renewal", amountCents: 23911 },
  { id: "T-1112", date: "2025-05-01", category: "field-maintenance", memo: "bulk order", amountCents: 55460 },
  { id: "T-1113", date: "2025-03-05", category: "marketing-services", memo: "quarterly invoice", amountCents: 86614 },
  { id: "T-1114", date: "2025-04-12", category: "retail-supplies", memo: "emergency replacement", amountCents: 7846 },
  { id: "T-1115", date: "2025-01-28", category: "training-supplies", memo: "reimbursement", amountCents: 66059 },
  { id: "T-1116", date: "2025-03-09", category: "studio-maintenance", memo: "restock order", amountCents: 80432 },
  { id: "T-1117", date: "2025-04-22", category: "fleet-supplies", memo: "service call", amountCents: 60417 },
  { id: "T-1118", date: "2025-06-05", category: "warehouse-services", memo: "reimbursement", amountCents: 21107 },
  { id: "T-1119", date: "2025-01-02", category: "fleet-maintenance", memo: "recurring charge", amountCents: 90653 },
  { id: "T-1120", date: "2025-05-28", category: "studio-maintenance", memo: "one-off purchase", amountCents: 68155 },
  { id: "T-1121", date: "2025-06-05", category: "field-supplies", memo: "expense report", amountCents: 7460 },
  { id: "T-1122", date: "2025-03-27", category: "studio-equipment", memo: "reimbursement", amountCents: 26565 },
  { id: "T-1123", date: "2025-06-19", category: "warehouse-maintenance", memo: "purchase order", amountCents: 32763 },
  { id: "T-1124", date: "2025-05-07", category: "studio-maintenance", memo: "restock order", amountCents: 37010 },
  { id: "T-1125", date: "2025-04-27", category: "retail-supplies", memo: "purchase order", amountCents: 22457 },
  { id: "T-1126", date: "2025-04-16", category: "warehouse-services", memo: "bulk order", amountCents: 58135 },
  { id: "T-1127", date: "2025-03-20", category: "field-services", memo: "bulk order", amountCents: 63803 },
  { id: "T-1128", date: "2025-05-23", category: "retail-supplies", memo: "contract renewal", amountCents: 46143 },
  { id: "T-1129", date: "2025-02-11", category: "marketing-supplies", memo: "service call", amountCents: 35941 },
  { id: "T-1130", date: "2025-03-05", category: "studio-supplies", memo: "expense report", amountCents: 53572 },
  { id: "T-1131", date: "2025-05-22", category: "events-supplies", memo: "bulk order", amountCents: 91779 },
  { id: "T-1132", date: "2025-06-01", category: "training-equipment", memo: "one-off purchase", amountCents: 92752 },
  { id: "T-1133", date: "2025-06-06", category: "field-equipment", memo: "reimbursement", amountCents: 98437 },
  { id: "T-1134", date: "2025-03-26", category: "studio-equipment", memo: "net-30 payment", amountCents: 45403 },
  { id: "T-1135", date: "2025-04-07", category: "vendor-maintenance", memo: "contract renewal", amountCents: 85344 },
  { id: "T-1136", date: "2025-02-24", category: "lab-maintenance", memo: "recurring charge", amountCents: 43233 },
  { id: "T-1137", date: "2025-06-21", category: "field-services", memo: "quarterly invoice", amountCents: 64939 },
  { id: "T-1138", date: "2025-03-26", category: "vendor-supplies", memo: "expense report", amountCents: 20167 },
  { id: "T-1139", date: "2025-06-09", category: "events-maintenance", memo: "emergency replacement", amountCents: 94262 },
  { id: "T-1140", date: "2025-04-10", category: "warehouse-supplies", memo: "purchase order", amountCents: 96967 },
  { id: "T-1141", date: "2025-02-04", category: "retail-equipment", memo: "one-off purchase", amountCents: 94775 },
  { id: "T-1142", date: "2025-05-25", category: "vendor-supplies", memo: "recurring charge", amountCents: 89504 },
  { id: "T-1143", date: "2025-01-14", category: "lab-maintenance", memo: "net-30 payment", amountCents: 51630 },
  { id: "T-1144", date: "2025-05-26", category: "field-maintenance", memo: "quarterly invoice", amountCents: 72765 },
  { id: "T-1145", date: "2025-01-23", category: "fleet-supplies", memo: "contract renewal", amountCents: 93976 },
  { id: "T-1146", date: "2025-03-26", category: "retail-equipment", memo: "reimbursement", amountCents: 76489 },
  { id: "T-1147", date: "2025-05-25", category: "training-supplies", memo: "contract renewal", amountCents: 44301 },
  { id: "T-1148", date: "2025-04-11", category: "office-supplies", memo: "restock order", amountCents: 25258 },
  { id: "T-1149", date: "2025-01-20", category: "marketing-services", memo: "reimbursement", amountCents: 81089 },
  { id: "T-1150", date: "2025-03-18", category: "office-equipment", memo: "emergency replacement", amountCents: 29851 },
  { id: "T-1151", date: "2025-02-20", category: "studio-supplies", memo: "quarterly invoice", amountCents: 84496 },
  { id: "T-1152", date: "2025-05-23", category: "field-services", memo: "quarterly invoice", amountCents: 21300 },
  { id: "T-1153", date: "2025-04-17", category: "events-supplies", memo: "service call", amountCents: 21695 },
  { id: "T-1154", date: "2025-02-22", category: "retail-services", memo: "restock order", amountCents: 50857 },
  { id: "T-1155", date: "2025-01-14", category: "lab-services", memo: "net-30 payment", amountCents: 42554 },
  { id: "T-1156", date: "2025-03-23", category: "studio-services", memo: "recurring charge", amountCents: 2194 },
  { id: "T-1157", date: "2025-06-21", category: "vendor-maintenance", memo: "contract renewal", amountCents: 95090 },
  { id: "T-1158", date: "2025-05-06", category: "retail-maintenance", memo: "contract renewal", amountCents: 61520 },
  { id: "T-1159", date: "2025-04-22", category: "fleet-equipment", memo: "bulk order", amountCents: 88921 },
  { id: "T-1160", date: "2025-05-03", category: "field-maintenance", memo: "quarterly invoice", amountCents: 15037 },
  { id: "T-1161", date: "2025-03-19", category: "fleet-services", memo: "net-30 payment", amountCents: 77030 },
  { id: "T-1162", date: "2025-06-02", category: "fleet-services", memo: "purchase order", amountCents: 15351 },
  { id: "T-1163", date: "2025-05-19", category: "warehouse-supplies", memo: "service call", amountCents: 71609 },
  { id: "T-1164", date: "2025-01-14", category: "retail-services", memo: "purchase order", amountCents: 60013 },
  { id: "T-1165", date: "2025-06-06", category: "studio-equipment", memo: "purchase order", amountCents: 99865 },
  { id: "T-1166", date: "2025-04-18", category: "events-supplies", memo: "net-30 payment", amountCents: 24219 },
  { id: "T-1167", date: "2025-01-21", category: "training-equipment", memo: "one-off purchase", amountCents: 93005 },
  { id: "T-1168", date: "2025-03-08", category: "facilities-maintenance", memo: "expense report", amountCents: 12690 },
  { id: "T-1169", date: "2025-05-16", category: "field-services", memo: "quarterly invoice", amountCents: 92377 },
  { id: "T-1170", date: "2025-04-17", category: "warehouse-maintenance", memo: "quarterly invoice", amountCents: 26009 },
  { id: "T-1171", date: "2025-05-05", category: "fleet-maintenance", memo: "net-30 payment", amountCents: 53912 },
  { id: "T-1172", date: "2025-03-27", category: "field-services", memo: "recurring charge", amountCents: 72260 },
  { id: "T-1173", date: "2025-04-14", category: "studio-maintenance", memo: "net-30 payment", amountCents: 17377 },
  { id: "T-1174", date: "2025-06-26", category: "training-supplies", memo: "reimbursement", amountCents: 82653 },
  { id: "T-1175", date: "2025-02-16", category: "lab-equipment", memo: "quarterly invoice", amountCents: 4084 },
  { id: "T-1176", date: "2025-02-28", category: "field-supplies", memo: "one-off purchase", amountCents: 82194 },
  { id: "T-1177", date: "2025-04-16", category: "lab-equipment", memo: "restock order", amountCents: 55761 },
  { id: "T-1178", date: "2025-03-01", category: "vendor-services", memo: "expense report", amountCents: 31330 },
  { id: "T-1179", date: "2025-02-18", category: "retail-maintenance", memo: "emergency replacement", amountCents: 65857 },
  { id: "T-1180", date: "2025-01-22", category: "lab-services", memo: "reimbursement", amountCents: 16542 },
  { id: "T-1181", date: "2025-02-05", category: "training-supplies", memo: "restock order", amountCents: 33874 },
  { id: "T-1182", date: "2025-05-16", category: "studio-supplies", memo: "purchase order", amountCents: 32999 },
  { id: "T-1183", date: "2025-06-28", category: "studio-supplies", memo: "purchase order", amountCents: 33375 },
  { id: "T-1184", date: "2025-02-11", category: "facilities-supplies", memo: "expense report", amountCents: 60556 },
  { id: "T-1185", date: "2025-02-02", category: "fleet-maintenance", memo: "recurring charge", amountCents: 21244 },
  { id: "T-1186", date: "2025-01-15", category: "warehouse-supplies", memo: "recurring charge", amountCents: 16087 },
  { id: "T-1187", date: "2025-03-15", category: "training-services", memo: "net-30 payment", amountCents: 80349 },
  { id: "T-1188", date: "2025-03-07", category: "warehouse-services", memo: "service call", amountCents: 47390 },
  { id: "T-1189", date: "2025-05-09", category: "fleet-equipment", memo: "one-off purchase", amountCents: 92064 },
  { id: "T-1190", date: "2025-01-15", category: "warehouse-maintenance", memo: "restock order", amountCents: 9389 },
  { id: "T-1191", date: "2025-01-10", category: "vendor-equipment", memo: "service call", amountCents: 68423 },
  { id: "T-1192", date: "2025-05-16", category: "training-equipment", memo: "restock order", amountCents: 23669 },
  { id: "T-1193", date: "2025-03-15", category: "vendor-services", memo: "purchase order", amountCents: 87377 },
  { id: "T-1194", date: "2025-06-03", category: "marketing-equipment", memo: "purchase order", amountCents: 60618 },
  { id: "T-1195", date: "2025-02-09", category: "field-equipment", memo: "quarterly invoice", amountCents: 25103 },
  { id: "T-1196", date: "2025-01-22", category: "field-equipment", memo: "reimbursement", amountCents: 48904 },
  { id: "T-1197", date: "2025-02-05", category: "studio-services", memo: "reimbursement", amountCents: 11085 },
  { id: "T-1198", date: "2025-05-19", category: "marketing-equipment", memo: "bulk order", amountCents: 72656 },
  { id: "T-1199", date: "2025-03-07", category: "vendor-maintenance", memo: "contract renewal", amountCents: 67129 },
  { id: "T-1200", date: "2025-05-27", category: "studio-supplies", memo: "purchase order", amountCents: 52039 },
  { id: "T-1201", date: "2025-02-18", category: "training-maintenance", memo: "expense report", amountCents: 48266 },
  { id: "T-1202", date: "2025-02-07", category: "vendor-maintenance", memo: "service call", amountCents: 23279 },
  { id: "T-1203", date: "2025-01-13", category: "warehouse-services", memo: "bulk order", amountCents: 81503 },
  { id: "T-1204", date: "2025-02-15", category: "studio-services", memo: "recurring charge", amountCents: 15948 },
  { id: "T-1205", date: "2025-04-13", category: "office-supplies", memo: "one-off purchase", amountCents: 19202 },
  { id: "T-1206", date: "2025-01-17", category: "retail-maintenance", memo: "purchase order", amountCents: 52027 },
  { id: "T-1207", date: "2025-02-19", category: "field-services", memo: "service call", amountCents: 87912 },
  { id: "T-1208", date: "2025-02-14", category: "events-equipment", memo: "restock order", amountCents: 23521 },
  { id: "T-1209", date: "2025-06-12", category: "office-equipment", memo: "one-off purchase", amountCents: 92475 },
  { id: "T-1210", date: "2025-04-27", category: "vendor-supplies", memo: "recurring charge", amountCents: 67764 },
  { id: "T-1211", date: "2025-06-06", category: "facilities-equipment", memo: "expense report", amountCents: 57125 },
  { id: "T-1212", date: "2025-04-22", category: "training-equipment", memo: "quarterly invoice", amountCents: 43098 },
  { id: "T-1213", date: "2025-01-07", category: "training-maintenance", memo: "bulk order", amountCents: 53625 },
  { id: "T-1214", date: "2025-04-10", category: "retail-equipment", memo: "service call", amountCents: 66752 },
  { id: "T-1215", date: "2025-03-05", category: "marketing-services", memo: "reimbursement", amountCents: 8680 },
  { id: "T-1216", date: "2025-04-27", category: "vendor-equipment", memo: "contract renewal", amountCents: 71435 },
  { id: "T-1217", date: "2025-03-10", category: "studio-maintenance", memo: "emergency replacement", amountCents: 19181 },
  { id: "T-1218", date: "2025-05-14", category: "fleet-services", memo: "quarterly invoice", amountCents: 98123 },
  { id: "T-1219", date: "2025-05-22", category: "fleet-maintenance", memo: "recurring charge", amountCents: 96565 },
  { id: "T-1220", date: "2025-03-12", category: "office-services", memo: "expense report", amountCents: 91429 },
  { id: "T-1221", date: "2025-04-02", category: "facilities-supplies", memo: "reimbursement", amountCents: 77100 },
  { id: "T-1222", date: "2025-04-20", category: "training-maintenance", memo: "net-30 payment", amountCents: 77531 },
  { id: "T-1223", date: "2025-06-28", category: "field-supplies", memo: "net-30 payment", amountCents: 82247 },
  { id: "T-1224", date: "2025-05-02", category: "retail-maintenance", memo: "recurring charge", amountCents: 23221 },
  { id: "T-1225", date: "2025-05-27", category: "warehouse-supplies", memo: "one-off purchase", amountCents: 56252 },
  { id: "T-1226", date: "2025-05-02", category: "field-services", memo: "quarterly invoice", amountCents: 75650 },
  { id: "T-1227", date: "2025-06-18", category: "marketing-equipment", memo: "one-off purchase", amountCents: 50630 },
  { id: "T-1228", date: "2025-03-25", category: "vendor-maintenance", memo: "service call", amountCents: 24596 },
  { id: "T-1229", date: "2025-03-06", category: "warehouse-services", memo: "purchase order", amountCents: 88909 },
  { id: "T-1230", date: "2025-05-06", category: "studio-equipment", memo: "service call", amountCents: 55562 },
  { id: "T-1231", date: "2025-02-26", category: "office-equipment", memo: "recurring charge", amountCents: 2579 },
  { id: "T-1232", date: "2025-02-03", category: "fleet-equipment", memo: "emergency replacement", amountCents: 30608 },
  { id: "T-1233", date: "2025-05-19", category: "events-services", memo: "net-30 payment", amountCents: 47543 },
  { id: "T-1234", date: "2025-01-01", category: "events-services", memo: "contract renewal", amountCents: 54791 },
  { id: "T-1235", date: "2025-02-18", category: "facilities-maintenance", memo: "quarterly invoice", amountCents: 33211 },
  { id: "T-1236", date: "2025-06-14", category: "studio-equipment", memo: "one-off purchase", amountCents: 88595 },
  { id: "T-1237", date: "2025-06-13", category: "retail-supplies", memo: "reimbursement", amountCents: 33188 },
  { id: "T-1238", date: "2025-05-10", category: "retail-equipment", memo: "restock order", amountCents: 8002 },
  { id: "T-1239", date: "2025-02-13", category: "field-maintenance", memo: "quarterly invoice", amountCents: 86794 },
  { id: "T-1240", date: "2025-01-20", category: "facilities-supplies", memo: "quarterly invoice", amountCents: 28309 },
  { id: "T-1241", date: "2025-02-12", category: "vendor-services", memo: "net-30 payment", amountCents: 86338 },
  { id: "T-1242", date: "2025-05-27", category: "facilities-maintenance", memo: "restock order", amountCents: 84609 },
  { id: "T-1243", date: "2025-04-15", category: "vendor-equipment", memo: "recurring charge", amountCents: 30157 },
  { id: "T-1244", date: "2025-04-20", category: "warehouse-services", memo: "quarterly invoice", amountCents: 42020 },
  { id: "T-1245", date: "2025-01-28", category: "warehouse-maintenance", memo: "restock order", amountCents: 70703 },
  { id: "T-1246", date: "2025-06-05", category: "marketing-supplies", memo: "recurring charge", amountCents: 87948 },
  { id: "T-1247", date: "2025-02-03", category: "warehouse-equipment", memo: "reimbursement", amountCents: 50810 },
  { id: "T-1248", date: "2025-06-16", category: "events-services", memo: "bulk order", amountCents: 14845 },
  { id: "T-1249", date: "2025-05-04", category: "warehouse-services", memo: "one-off purchase", amountCents: 29142 },
  { id: "T-1250", date: "2025-06-15", category: "studio-supplies", memo: "purchase order", amountCents: 44470 },
  { id: "T-1251", date: "2025-06-28", category: "training-services", memo: "recurring charge", amountCents: 46872 },
  { id: "T-1252", date: "2025-04-03", category: "marketing-services", memo: "one-off purchase", amountCents: 90888 },
  { id: "T-1253", date: "2025-06-28", category: "field-supplies", memo: "restock order", amountCents: 44883 },
  { id: "T-1254", date: "2025-02-12", category: "training-maintenance", memo: "restock order", amountCents: 4780 },
  { id: "T-1255", date: "2025-03-01", category: "events-services", memo: "reimbursement", amountCents: 12392 },
  { id: "T-1256", date: "2025-05-02", category: "retail-equipment", memo: "quarterly invoice", amountCents: 85373 },
  { id: "T-1257", date: "2025-06-28", category: "warehouse-supplies", memo: "reimbursement", amountCents: 42010 },
  { id: "T-1258", date: "2025-01-02", category: "office-equipment", memo: "one-off purchase", amountCents: 21070 },
  { id: "T-1259", date: "2025-03-01", category: "office-equipment", memo: "emergency replacement", amountCents: 10296 },
  { id: "T-1260", date: "2025-04-09", category: "facilities-supplies", memo: "restock order", amountCents: 61071 },
  { id: "T-1261", date: "2025-04-02", category: "studio-services", memo: "expense report", amountCents: 81108 },
  { id: "T-1262", date: "2025-03-07", category: "warehouse-equipment", memo: "purchase order", amountCents: 11194 },
  { id: "T-1263", date: "2025-05-28", category: "training-supplies", memo: "net-30 payment", amountCents: 22273 },
  { id: "T-1264", date: "2025-06-05", category: "training-maintenance", memo: "one-off purchase", amountCents: 39295 },
  { id: "T-1265", date: "2025-02-28", category: "events-supplies", memo: "purchase order", amountCents: 84162 },
  { id: "T-1266", date: "2025-04-20", category: "training-supplies", memo: "restock order", amountCents: 20971 },
  { id: "T-1267", date: "2025-02-09", category: "field-services", memo: "bulk order", amountCents: 37182 },
  { id: "T-1268", date: "2025-01-19", category: "vendor-supplies", memo: "restock order", amountCents: 43585 },
  { id: "T-1269", date: "2025-05-21", category: "field-supplies", memo: "contract renewal", amountCents: 37030 },
  { id: "T-1270", date: "2025-06-03", category: "retail-equipment", memo: "bulk order", amountCents: 1451 },
  { id: "T-1271", date: "2025-02-26", category: "training-supplies", memo: "purchase order", amountCents: 87606 },
  { id: "T-1272", date: "2025-04-07", category: "field-services", memo: "restock order", amountCents: 58932 },
  { id: "T-1273", date: "2025-04-15", category: "office-supplies", memo: "emergency replacement", amountCents: 50514 },
  { id: "T-1274", date: "2025-04-17", category: "training-services", memo: "one-off purchase", amountCents: 4275 },
  { id: "T-1275", date: "2025-06-17", category: "office-supplies", memo: "quarterly invoice", amountCents: 33766 },
  { id: "T-1276", date: "2025-06-07", category: "events-maintenance", memo: "one-off purchase", amountCents: 26884 },
  { id: "T-1277", date: "2025-05-09", category: "warehouse-supplies", memo: "net-30 payment", amountCents: 43992 },
  { id: "T-1278", date: "2025-02-15", category: "training-equipment", memo: "quarterly invoice", amountCents: 4999 },
  { id: "T-1279", date: "2025-03-13", category: "vendor-equipment", memo: "emergency replacement", amountCents: 54832 },
  { id: "T-1280", date: "2025-05-09", category: "training-maintenance", memo: "bulk order", amountCents: 51626 },
  { id: "T-1281", date: "2025-04-09", category: "office-maintenance", memo: "contract renewal", amountCents: 78686 },
  { id: "T-1282", date: "2025-04-08", category: "events-supplies", memo: "service call", amountCents: 51308 },
  { id: "T-1283", date: "2025-06-16", category: "vendor-maintenance", memo: "service call", amountCents: 53213 },
  { id: "T-1284", date: "2025-05-14", category: "retail-services", memo: "emergency replacement", amountCents: 86374 },
  { id: "T-1285", date: "2025-03-15", category: "studio-equipment", memo: "expense report", amountCents: 30247 },
  { id: "T-1286", date: "2025-05-02", category: "events-maintenance", memo: "one-off purchase", amountCents: 77642 },
  { id: "T-1287", date: "2025-03-01", category: "lab-maintenance", memo: "bulk order", amountCents: 94805 },
  { id: "T-1288", date: "2025-05-23", category: "field-supplies", memo: "net-30 payment", amountCents: 77815 },
  { id: "T-1289", date: "2025-05-18", category: "warehouse-supplies", memo: "recurring charge", amountCents: 31594 },
  { id: "T-1290", date: "2025-04-26", category: "office-services", memo: "bulk order", amountCents: 14041 },
  { id: "T-1291", date: "2025-03-07", category: "studio-equipment", memo: "one-off purchase", amountCents: 83310 },
  { id: "T-1292", date: "2025-04-24", category: "vendor-equipment", memo: "purchase order", amountCents: 13871 },
  { id: "T-1293", date: "2025-01-22", category: "retail-equipment", memo: "expense report", amountCents: 91865 },
  { id: "T-1294", date: "2025-01-12", category: "lab-equipment", memo: "recurring charge", amountCents: 91443 },
  { id: "T-1295", date: "2025-04-22", category: "field-equipment", memo: "contract renewal", amountCents: 53356 },
  { id: "T-1296", date: "2025-03-10", category: "vendor-maintenance", memo: "reimbursement", amountCents: 35861 },
  { id: "T-1297", date: "2025-06-12", category: "vendor-equipment", memo: "service call", amountCents: 50639 },
  { id: "T-1298", date: "2025-05-24", category: "vendor-supplies", memo: "emergency replacement", amountCents: 95882 },
  { id: "T-1299", date: "2025-04-16", category: "warehouse-equipment", memo: "bulk order", amountCents: 32164 },
  { id: "T-1300", date: "2025-04-14", category: "warehouse-maintenance", memo: "service call", amountCents: 51730 },
  { id: "T-1301", date: "2025-01-11", category: "fleet-maintenance", memo: "bulk order", amountCents: 55583 },
  { id: "T-1302", date: "2025-02-09", category: "training-maintenance", memo: "purchase order", amountCents: 91586 },
  { id: "T-1303", date: "2025-02-03", category: "fleet-maintenance", memo: "one-off purchase", amountCents: 15985 },
  { id: "T-1304", date: "2025-03-15", category: "field-maintenance", memo: "contract renewal", amountCents: 37566 },
  { id: "T-1305", date: "2025-06-19", category: "facilities-maintenance", memo: "bulk order", amountCents: 34101 },
  { id: "T-1306", date: "2025-04-15", category: "studio-equipment", memo: "bulk order", amountCents: 2538 },
  { id: "T-1307", date: "2025-05-13", category: "studio-equipment", memo: "one-off purchase", amountCents: 37565 },
  { id: "T-1308", date: "2025-02-01", category: "events-services", memo: "contract renewal", amountCents: 4366 },
  { id: "T-1309", date: "2025-04-27", category: "studio-services", memo: "one-off purchase", amountCents: 14289 },
  { id: "T-1310", date: "2025-06-16", category: "training-supplies", memo: "one-off purchase", amountCents: 79992 },
  { id: "T-1311", date: "2025-06-01", category: "retail-equipment", memo: "bulk order", amountCents: 32873 },
  { id: "T-1312", date: "2025-02-07", category: "warehouse-supplies", memo: "purchase order", amountCents: 43887 },
  { id: "T-1313", date: "2025-06-11", category: "facilities-equipment", memo: "service call", amountCents: 58124 },
  { id: "T-1314", date: "2025-03-22", category: "studio-maintenance", memo: "reimbursement", amountCents: 82160 },
  { id: "T-1315", date: "2025-06-06", category: "warehouse-services", memo: "bulk order", amountCents: 62487 },
  { id: "T-1316", date: "2025-01-23", category: "field-services", memo: "expense report", amountCents: 70217 },
  { id: "T-1317", date: "2025-04-17", category: "events-services", memo: "quarterly invoice", amountCents: 1537 },
  { id: "T-1318", date: "2025-06-17", category: "lab-services", memo: "expense report", amountCents: 30089 },
  { id: "T-1319", date: "2025-02-07", category: "training-supplies", memo: "purchase order", amountCents: 53795 },
  { id: "T-1320", date: "2025-04-16", category: "fleet-services", memo: "net-30 payment", amountCents: 63380 },
  { id: "T-1321", date: "2025-06-24", category: "events-equipment", memo: "reimbursement", amountCents: 15337 },
  { id: "T-1322", date: "2025-01-15", category: "lab-maintenance", memo: "net-30 payment", amountCents: 22612 },
  { id: "T-1323", date: "2025-03-18", category: "facilities-maintenance", memo: "bulk order", amountCents: 80246 },
  { id: "T-1324", date: "2025-05-03", category: "office-maintenance", memo: "emergency replacement", amountCents: 63292 },
  { id: "T-1325", date: "2025-02-24", category: "lab-supplies", memo: "net-30 payment", amountCents: 5016 },
  { id: "T-1326", date: "2025-05-14", category: "field-maintenance", memo: "service call", amountCents: 32822 },
  { id: "T-1327", date: "2025-06-21", category: "events-equipment", memo: "reimbursement", amountCents: 20128 },
  { id: "T-1328", date: "2025-06-17", category: "facilities-equipment", memo: "service call", amountCents: 23777 },
  { id: "T-1329", date: "2025-05-23", category: "marketing-equipment", memo: "bulk order", amountCents: 97889 },
  { id: "T-1330", date: "2025-06-19", category: "fleet-services", memo: "one-off purchase", amountCents: 87921 },
  { id: "T-1331", date: "2025-06-18", category: "retail-supplies", memo: "purchase order", amountCents: 43454 },
  { id: "T-1332", date: "2025-04-20", category: "events-supplies", memo: "bulk order", amountCents: 57274 },
  { id: "T-1333", date: "2025-06-09", category: "office-services", memo: "expense report", amountCents: 69422 },
  { id: "T-1334", date: "2025-05-14", category: "warehouse-services", memo: "net-30 payment", amountCents: 50723 },
  { id: "T-1335", date: "2025-01-17", category: "training-services", memo: "net-30 payment", amountCents: 64260 },
  { id: "T-1336", date: "2025-02-12", category: "office-services", memo: "net-30 payment", amountCents: 3840 },
  { id: "T-1337", date: "2025-03-27", category: "field-maintenance", memo: "contract renewal", amountCents: 1495 },
  { id: "T-1338", date: "2025-04-24", category: "marketing-maintenance", memo: "emergency replacement", amountCents: 87579 },
  { id: "T-1339", date: "2025-02-14", category: "warehouse-equipment", memo: "expense report", amountCents: 89228 },
  { id: "T-1340", date: "2025-03-07", category: "warehouse-supplies", memo: "recurring charge", amountCents: 56189 },
  { id: "T-1341", date: "2025-01-05", category: "field-services", memo: "net-30 payment", amountCents: 25224 },
  { id: "T-1342", date: "2025-01-10", category: "fleet-services", memo: "emergency replacement", amountCents: 82429 },
  { id: "T-1343", date: "2025-04-01", category: "marketing-equipment", memo: "restock order", amountCents: 14102 },
  { id: "T-1344", date: "2025-04-02", category: "vendor-maintenance", memo: "net-30 payment", amountCents: 35118 },
  { id: "T-1345", date: "2025-04-01", category: "facilities-maintenance", memo: "service call", amountCents: 81135 },
  { id: "T-1346", date: "2025-04-12", category: "marketing-services", memo: "service call", amountCents: 58089 },
  { id: "T-1347", date: "2025-01-18", category: "office-supplies", memo: "emergency replacement", amountCents: 41435 },
  { id: "T-1348", date: "2025-06-02", category: "fleet-maintenance", memo: "one-off purchase", amountCents: 81276 },
  { id: "T-1349", date: "2025-05-10", category: "office-equipment", memo: "one-off purchase", amountCents: 22035 },
  { id: "T-1350", date: "2025-02-27", category: "marketing-supplies", memo: "reimbursement", amountCents: 65639 },
  { id: "T-1351", date: "2025-04-25", category: "vendor-maintenance", memo: "reimbursement", amountCents: 41604 },
  { id: "T-1352", date: "2025-02-21", category: "marketing-equipment", memo: "net-30 payment", amountCents: 58509 },
  { id: "T-1353", date: "2025-04-14", category: "events-equipment", memo: "expense report", amountCents: 44350 },
  { id: "T-1354", date: "2025-03-05", category: "marketing-supplies", memo: "net-30 payment", amountCents: 6508 },
  { id: "T-1355", date: "2025-03-01", category: "office-supplies", memo: "contract renewal", amountCents: 31329 },
  { id: "T-1356", date: "2025-03-01", category: "warehouse-equipment", memo: "net-30 payment", amountCents: 11959 },
  { id: "T-1357", date: "2025-02-11", category: "lab-services", memo: "one-off purchase", amountCents: 87079 },
  { id: "T-1358", date: "2025-04-05", category: "field-supplies", memo: "contract renewal", amountCents: 97494 },
  { id: "T-1359", date: "2025-03-19", category: "events-equipment", memo: "one-off purchase", amountCents: 13977 },
  { id: "T-1360", date: "2025-06-15", category: "retail-services", memo: "net-30 payment", amountCents: 13885 },
  { id: "T-1361", date: "2025-06-06", category: "training-supplies", memo: "bulk order", amountCents: 47855 },
  { id: "T-1362", date: "2025-05-05", category: "vendor-services", memo: "emergency replacement", amountCents: 61449 },
  { id: "T-1363", date: "2025-02-13", category: "fleet-supplies", memo: "reimbursement", amountCents: 9411 },
  { id: "T-1364", date: "2025-01-23", category: "training-supplies", memo: "one-off purchase", amountCents: 77277 },
  { id: "T-1365", date: "2025-03-07", category: "field-maintenance", memo: "recurring charge", amountCents: 36478 },
  { id: "T-1366", date: "2025-04-20", category: "lab-maintenance", memo: "one-off purchase", amountCents: 93627 },
  { id: "T-1367", date: "2025-05-18", category: "fleet-supplies", memo: "purchase order", amountCents: 88535 },
  { id: "T-1368", date: "2025-05-27", category: "lab-maintenance", memo: "service call", amountCents: 12389 },
  { id: "T-1369", date: "2025-04-01", category: "marketing-supplies", memo: "recurring charge", amountCents: 737 },
  { id: "T-1370", date: "2025-05-01", category: "lab-supplies", memo: "emergency replacement", amountCents: 71685 },
  { id: "T-1371", date: "2025-05-13", category: "fleet-services", memo: "restock order", amountCents: 31887 },
  { id: "T-1372", date: "2025-06-06", category: "vendor-supplies", memo: "purchase order", amountCents: 68722 },
  { id: "T-1373", date: "2025-06-22", category: "lab-services", memo: "service call", amountCents: 92582 },
  { id: "T-1374", date: "2025-03-11", category: "events-equipment", memo: "recurring charge", amountCents: 5097 },
  { id: "T-1375", date: "2025-03-24", category: "warehouse-maintenance", memo: "net-30 payment", amountCents: 6687 },
  { id: "T-1376", date: "2025-01-22", category: "marketing-equipment", memo: "expense report", amountCents: 93109 },
  { id: "T-1377", date: "2025-03-14", category: "fleet-equipment", memo: "expense report", amountCents: 88337 },
  { id: "T-1378", date: "2025-05-12", category: "office-services", memo: "one-off purchase", amountCents: 41638 },
  { id: "T-1379", date: "2025-01-06", category: "retail-equipment", memo: "service call", amountCents: 20711 },
  { id: "T-1380", date: "2025-01-08", category: "vendor-equipment", memo: "reimbursement", amountCents: 29189 },
  { id: "T-1381", date: "2025-01-08", category: "training-maintenance", memo: "restock order", amountCents: 94714 },
  { id: "T-1382", date: "2025-02-23", category: "warehouse-supplies", memo: "recurring charge", amountCents: 3702 },
  { id: "T-1383", date: "2025-01-22", category: "field-supplies", memo: "emergency replacement", amountCents: 81157 },
  { id: "T-1384", date: "2025-01-11", category: "field-services", memo: "expense report", amountCents: 26998 },
  { id: "T-1385", date: "2025-01-10", category: "events-equipment", memo: "contract renewal", amountCents: 49613 },
  { id: "T-1386", date: "2025-03-07", category: "facilities-supplies", memo: "emergency replacement", amountCents: 61017 },
  { id: "T-1387", date: "2025-06-06", category: "retail-equipment", memo: "net-30 payment", amountCents: 14713 },
  { id: "T-1388", date: "2025-01-23", category: "warehouse-equipment", memo: "purchase order", amountCents: 34854 },
  { id: "T-1389", date: "2025-01-27", category: "vendor-equipment", memo: "reimbursement", amountCents: 85791 },
  { id: "T-1390", date: "2025-06-18", category: "training-services", memo: "bulk order", amountCents: 57889 },
  { id: "T-1391", date: "2025-05-16", category: "marketing-maintenance", memo: "restock order", amountCents: 69479 },
  { id: "T-1392", date: "2025-01-19", category: "retail-services", memo: "purchase order", amountCents: 81492 },
  { id: "T-1393", date: "2025-01-10", category: "marketing-supplies", memo: "service call", amountCents: 87262 },
  { id: "T-1394", date: "2025-06-14", category: "fleet-supplies", memo: "recurring charge", amountCents: 3125 },
  { id: "T-1395", date: "2025-06-27", category: "vendor-maintenance", memo: "net-30 payment", amountCents: 45296 },
  { id: "T-1396", date: "2025-04-02", category: "warehouse-equipment", memo: "quarterly invoice", amountCents: 46775 },
  { id: "T-1397", date: "2025-01-05", category: "warehouse-maintenance", memo: "emergency replacement", amountCents: 42240 },
  { id: "T-1398", date: "2025-05-10", category: "office-supplies", memo: "contract renewal", amountCents: 44962 },
  { id: "T-1399", date: "2025-02-20", category: "marketing-services", memo: "emergency replacement", amountCents: 92501 },
  { id: "T-1400", date: "2025-04-11", category: "office-equipment", memo: "restock order", amountCents: 30361 },
];

// --- office-supplies ---

export function filterOfficeSuppliesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_OFFICE_SERVICES);
}

export function sumOfficeSuppliesCents(entries: readonly LedgerEntry[]): number {
  return filterOfficeSuppliesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countOfficeSuppliesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterOfficeSuppliesEntries(entries).length;
}

export function largestOfficeSuppliesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterOfficeSuppliesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- office-services ---

export function filterOfficeServicesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_OFFICE_SERVICES);
}

export function sumOfficeServicesCents(entries: readonly LedgerEntry[]): number {
  return filterOfficeServicesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countOfficeServicesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterOfficeServicesEntries(entries).length;
}

export function largestOfficeServicesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterOfficeServicesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- office-equipment ---

export function filterOfficeEquipmentEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_OFFICE_EQUIPMENT);
}

export function sumOfficeEquipmentCents(entries: readonly LedgerEntry[]): number {
  return filterOfficeEquipmentEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countOfficeEquipmentEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterOfficeEquipmentEntries(entries).length;
}

export function largestOfficeEquipmentAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterOfficeEquipmentEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- office-maintenance ---

export function filterOfficeMaintenanceEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_OFFICE_MAINTENANCE);
}

export function sumOfficeMaintenanceCents(entries: readonly LedgerEntry[]): number {
  return filterOfficeMaintenanceEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countOfficeMaintenanceEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterOfficeMaintenanceEntries(entries).length;
}

export function largestOfficeMaintenanceAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterOfficeMaintenanceEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- field-supplies ---

export function filterFieldSuppliesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_FIELD_SUPPLIES);
}

export function sumFieldSuppliesCents(entries: readonly LedgerEntry[]): number {
  return filterFieldSuppliesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countFieldSuppliesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterFieldSuppliesEntries(entries).length;
}

export function largestFieldSuppliesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterFieldSuppliesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- field-services ---

export function filterFieldServicesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_FIELD_SERVICES);
}

export function sumFieldServicesCents(entries: readonly LedgerEntry[]): number {
  return filterFieldServicesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countFieldServicesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterFieldServicesEntries(entries).length;
}

export function largestFieldServicesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterFieldServicesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- field-equipment ---

export function filterFieldEquipmentEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_FIELD_EQUIPMENT);
}

export function sumFieldEquipmentCents(entries: readonly LedgerEntry[]): number {
  return filterFieldEquipmentEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countFieldEquipmentEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterFieldEquipmentEntries(entries).length;
}

export function largestFieldEquipmentAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterFieldEquipmentEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- field-maintenance ---

export function filterFieldMaintenanceEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_FIELD_MAINTENANCE);
}

export function sumFieldMaintenanceCents(entries: readonly LedgerEntry[]): number {
  return filterFieldMaintenanceEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countFieldMaintenanceEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterFieldMaintenanceEntries(entries).length;
}

export function largestFieldMaintenanceAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterFieldMaintenanceEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- vendor-supplies ---

export function filterVendorSuppliesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_VENDOR_SUPPLIES);
}

export function sumVendorSuppliesCents(entries: readonly LedgerEntry[]): number {
  return filterVendorSuppliesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countVendorSuppliesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterVendorSuppliesEntries(entries).length;
}

export function largestVendorSuppliesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterVendorSuppliesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- vendor-services ---

export function filterVendorServicesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_VENDOR_SERVICES);
}

export function sumVendorServicesCents(entries: readonly LedgerEntry[]): number {
  return filterVendorServicesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countVendorServicesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterVendorServicesEntries(entries).length;
}

export function largestVendorServicesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterVendorServicesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- vendor-equipment ---

export function filterVendorEquipmentEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_VENDOR_EQUIPMENT);
}

export function sumVendorEquipmentCents(entries: readonly LedgerEntry[]): number {
  return filterVendorEquipmentEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countVendorEquipmentEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterVendorEquipmentEntries(entries).length;
}

export function largestVendorEquipmentAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterVendorEquipmentEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- vendor-maintenance ---

export function filterVendorMaintenanceEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_VENDOR_MAINTENANCE);
}

export function sumVendorMaintenanceCents(entries: readonly LedgerEntry[]): number {
  return filterVendorMaintenanceEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countVendorMaintenanceEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterVendorMaintenanceEntries(entries).length;
}

export function largestVendorMaintenanceAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterVendorMaintenanceEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- facilities-supplies ---

export function filterFacilitiesSuppliesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_FACILITIES_SUPPLIES);
}

export function sumFacilitiesSuppliesCents(entries: readonly LedgerEntry[]): number {
  return filterFacilitiesSuppliesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countFacilitiesSuppliesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterFacilitiesSuppliesEntries(entries).length;
}

export function largestFacilitiesSuppliesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterFacilitiesSuppliesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- facilities-services ---

export function filterFacilitiesServicesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_FACILITIES_SERVICES);
}

export function sumFacilitiesServicesCents(entries: readonly LedgerEntry[]): number {
  return filterFacilitiesServicesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countFacilitiesServicesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterFacilitiesServicesEntries(entries).length;
}

export function largestFacilitiesServicesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterFacilitiesServicesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- facilities-equipment ---

export function filterFacilitiesEquipmentEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_FACILITIES_EQUIPMENT);
}

export function sumFacilitiesEquipmentCents(entries: readonly LedgerEntry[]): number {
  return filterFacilitiesEquipmentEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countFacilitiesEquipmentEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterFacilitiesEquipmentEntries(entries).length;
}

export function largestFacilitiesEquipmentAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterFacilitiesEquipmentEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- facilities-maintenance ---

export function filterFacilitiesMaintenanceEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_FACILITIES_MAINTENANCE);
}

export function sumFacilitiesMaintenanceCents(entries: readonly LedgerEntry[]): number {
  return filterFacilitiesMaintenanceEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countFacilitiesMaintenanceEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterFacilitiesMaintenanceEntries(entries).length;
}

export function largestFacilitiesMaintenanceAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterFacilitiesMaintenanceEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- marketing-supplies ---

export function filterMarketingSuppliesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_MARKETING_SUPPLIES);
}

export function sumMarketingSuppliesCents(entries: readonly LedgerEntry[]): number {
  return filterMarketingSuppliesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countMarketingSuppliesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterMarketingSuppliesEntries(entries).length;
}

export function largestMarketingSuppliesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterMarketingSuppliesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- marketing-services ---

export function filterMarketingServicesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_MARKETING_SERVICES);
}

export function sumMarketingServicesCents(entries: readonly LedgerEntry[]): number {
  return filterMarketingServicesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countMarketingServicesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterMarketingServicesEntries(entries).length;
}

export function largestMarketingServicesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterMarketingServicesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- marketing-equipment ---

export function filterMarketingEquipmentEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_MARKETING_EQUIPMENT);
}

export function sumMarketingEquipmentCents(entries: readonly LedgerEntry[]): number {
  return filterMarketingEquipmentEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countMarketingEquipmentEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterMarketingEquipmentEntries(entries).length;
}

export function largestMarketingEquipmentAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterMarketingEquipmentEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- marketing-maintenance ---

export function filterMarketingMaintenanceEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_MARKETING_MAINTENANCE);
}

export function sumMarketingMaintenanceCents(entries: readonly LedgerEntry[]): number {
  return filterMarketingMaintenanceEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countMarketingMaintenanceEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterMarketingMaintenanceEntries(entries).length;
}

export function largestMarketingMaintenanceAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterMarketingMaintenanceEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- events-supplies ---

export function filterEventsSuppliesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_EVENTS_SUPPLIES);
}

export function sumEventsSuppliesCents(entries: readonly LedgerEntry[]): number {
  return filterEventsSuppliesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countEventsSuppliesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterEventsSuppliesEntries(entries).length;
}

export function largestEventsSuppliesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterEventsSuppliesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- events-services ---

export function filterEventsServicesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_EVENTS_SERVICES);
}

export function sumEventsServicesCents(entries: readonly LedgerEntry[]): number {
  return filterEventsServicesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countEventsServicesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterEventsServicesEntries(entries).length;
}

export function largestEventsServicesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterEventsServicesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- events-equipment ---

export function filterEventsEquipmentEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_EVENTS_EQUIPMENT);
}

export function sumEventsEquipmentCents(entries: readonly LedgerEntry[]): number {
  return filterEventsEquipmentEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countEventsEquipmentEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterEventsEquipmentEntries(entries).length;
}

export function largestEventsEquipmentAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterEventsEquipmentEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- events-maintenance ---

export function filterEventsMaintenanceEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_EVENTS_MAINTENANCE);
}

export function sumEventsMaintenanceCents(entries: readonly LedgerEntry[]): number {
  return filterEventsMaintenanceEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countEventsMaintenanceEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterEventsMaintenanceEntries(entries).length;
}

export function largestEventsMaintenanceAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterEventsMaintenanceEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- fleet-supplies ---

export function filterFleetSuppliesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_FLEET_SUPPLIES);
}

export function sumFleetSuppliesCents(entries: readonly LedgerEntry[]): number {
  return filterFleetSuppliesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countFleetSuppliesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterFleetSuppliesEntries(entries).length;
}

export function largestFleetSuppliesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterFleetSuppliesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- fleet-services ---

export function filterFleetServicesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_FLEET_SERVICES);
}

export function sumFleetServicesCents(entries: readonly LedgerEntry[]): number {
  return filterFleetServicesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countFleetServicesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterFleetServicesEntries(entries).length;
}

export function largestFleetServicesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterFleetServicesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- fleet-equipment ---

export function filterFleetEquipmentEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_FLEET_EQUIPMENT);
}

export function sumFleetEquipmentCents(entries: readonly LedgerEntry[]): number {
  return filterFleetEquipmentEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countFleetEquipmentEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterFleetEquipmentEntries(entries).length;
}

export function largestFleetEquipmentAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterFleetEquipmentEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- fleet-maintenance ---

export function filterFleetMaintenanceEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_FLEET_MAINTENANCE);
}

export function sumFleetMaintenanceCents(entries: readonly LedgerEntry[]): number {
  return filterFleetMaintenanceEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countFleetMaintenanceEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterFleetMaintenanceEntries(entries).length;
}

export function largestFleetMaintenanceAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterFleetMaintenanceEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- training-supplies ---

export function filterTrainingSuppliesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_TRAINING_SUPPLIES);
}

export function sumTrainingSuppliesCents(entries: readonly LedgerEntry[]): number {
  return filterTrainingSuppliesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countTrainingSuppliesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterTrainingSuppliesEntries(entries).length;
}

export function largestTrainingSuppliesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterTrainingSuppliesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- training-services ---

export function filterTrainingServicesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_TRAINING_SERVICES);
}

export function sumTrainingServicesCents(entries: readonly LedgerEntry[]): number {
  return filterTrainingServicesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countTrainingServicesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterTrainingServicesEntries(entries).length;
}

export function largestTrainingServicesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterTrainingServicesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- training-equipment ---

export function filterTrainingEquipmentEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_TRAINING_EQUIPMENT);
}

export function sumTrainingEquipmentCents(entries: readonly LedgerEntry[]): number {
  return filterTrainingEquipmentEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countTrainingEquipmentEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterTrainingEquipmentEntries(entries).length;
}

export function largestTrainingEquipmentAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterTrainingEquipmentEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- training-maintenance ---

export function filterTrainingMaintenanceEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_TRAINING_MAINTENANCE);
}

export function sumTrainingMaintenanceCents(entries: readonly LedgerEntry[]): number {
  return filterTrainingMaintenanceEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countTrainingMaintenanceEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterTrainingMaintenanceEntries(entries).length;
}

export function largestTrainingMaintenanceAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterTrainingMaintenanceEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- lab-supplies ---

export function filterLabSuppliesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_LAB_SUPPLIES);
}

export function sumLabSuppliesCents(entries: readonly LedgerEntry[]): number {
  return filterLabSuppliesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countLabSuppliesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterLabSuppliesEntries(entries).length;
}

export function largestLabSuppliesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterLabSuppliesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- lab-services ---

export function filterLabServicesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_LAB_SERVICES);
}

export function sumLabServicesCents(entries: readonly LedgerEntry[]): number {
  return filterLabServicesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countLabServicesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterLabServicesEntries(entries).length;
}

export function largestLabServicesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterLabServicesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- lab-equipment ---

export function filterLabEquipmentEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_LAB_EQUIPMENT);
}

export function sumLabEquipmentCents(entries: readonly LedgerEntry[]): number {
  return filterLabEquipmentEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countLabEquipmentEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterLabEquipmentEntries(entries).length;
}

export function largestLabEquipmentAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterLabEquipmentEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- lab-maintenance ---

export function filterLabMaintenanceEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_LAB_MAINTENANCE);
}

export function sumLabMaintenanceCents(entries: readonly LedgerEntry[]): number {
  return filterLabMaintenanceEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countLabMaintenanceEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterLabMaintenanceEntries(entries).length;
}

export function largestLabMaintenanceAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterLabMaintenanceEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- studio-supplies ---

export function filterStudioSuppliesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_STUDIO_SUPPLIES);
}

export function sumStudioSuppliesCents(entries: readonly LedgerEntry[]): number {
  return filterStudioSuppliesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countStudioSuppliesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterStudioSuppliesEntries(entries).length;
}

export function largestStudioSuppliesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterStudioSuppliesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- studio-services ---

export function filterStudioServicesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_STUDIO_SERVICES);
}

export function sumStudioServicesCents(entries: readonly LedgerEntry[]): number {
  return filterStudioServicesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countStudioServicesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterStudioServicesEntries(entries).length;
}

export function largestStudioServicesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterStudioServicesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- studio-equipment ---

export function filterStudioEquipmentEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_STUDIO_EQUIPMENT);
}

export function sumStudioEquipmentCents(entries: readonly LedgerEntry[]): number {
  return filterStudioEquipmentEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countStudioEquipmentEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterStudioEquipmentEntries(entries).length;
}

export function largestStudioEquipmentAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterStudioEquipmentEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- studio-maintenance ---

export function filterStudioMaintenanceEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_STUDIO_MAINTENANCE);
}

export function sumStudioMaintenanceCents(entries: readonly LedgerEntry[]): number {
  return filterStudioMaintenanceEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countStudioMaintenanceEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterStudioMaintenanceEntries(entries).length;
}

export function largestStudioMaintenanceAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterStudioMaintenanceEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- warehouse-supplies ---

export function filterWarehouseSuppliesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_WAREHOUSE_SUPPLIES);
}

export function sumWarehouseSuppliesCents(entries: readonly LedgerEntry[]): number {
  return filterWarehouseSuppliesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countWarehouseSuppliesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterWarehouseSuppliesEntries(entries).length;
}

export function largestWarehouseSuppliesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterWarehouseSuppliesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- warehouse-services ---

export function filterWarehouseServicesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_WAREHOUSE_SERVICES);
}

export function sumWarehouseServicesCents(entries: readonly LedgerEntry[]): number {
  return filterWarehouseServicesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countWarehouseServicesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterWarehouseServicesEntries(entries).length;
}

export function largestWarehouseServicesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterWarehouseServicesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- warehouse-equipment ---

export function filterWarehouseEquipmentEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_WAREHOUSE_EQUIPMENT);
}

export function sumWarehouseEquipmentCents(entries: readonly LedgerEntry[]): number {
  return filterWarehouseEquipmentEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countWarehouseEquipmentEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterWarehouseEquipmentEntries(entries).length;
}

export function largestWarehouseEquipmentAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterWarehouseEquipmentEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- warehouse-maintenance ---

export function filterWarehouseMaintenanceEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_WAREHOUSE_MAINTENANCE);
}

export function sumWarehouseMaintenanceCents(entries: readonly LedgerEntry[]): number {
  return filterWarehouseMaintenanceEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countWarehouseMaintenanceEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterWarehouseMaintenanceEntries(entries).length;
}

export function largestWarehouseMaintenanceAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterWarehouseMaintenanceEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- retail-supplies ---

export function filterRetailSuppliesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_RETAIL_SUPPLIES);
}

export function sumRetailSuppliesCents(entries: readonly LedgerEntry[]): number {
  return filterRetailSuppliesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countRetailSuppliesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterRetailSuppliesEntries(entries).length;
}

export function largestRetailSuppliesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterRetailSuppliesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- retail-services ---

export function filterRetailServicesEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_RETAIL_SERVICES);
}

export function sumRetailServicesCents(entries: readonly LedgerEntry[]): number {
  return filterRetailServicesEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countRetailServicesEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterRetailServicesEntries(entries).length;
}

export function largestRetailServicesAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterRetailServicesEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- retail-equipment ---

export function filterRetailEquipmentEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_RETAIL_EQUIPMENT);
}

export function sumRetailEquipmentCents(entries: readonly LedgerEntry[]): number {
  return filterRetailEquipmentEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countRetailEquipmentEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterRetailEquipmentEntries(entries).length;
}

export function largestRetailEquipmentAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterRetailEquipmentEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- retail-maintenance ---

export function filterRetailMaintenanceEntries(
  entries: readonly LedgerEntry[],
): LedgerEntry[] {
  return entries.filter((entry) => entry.category === CATEGORY_RETAIL_MAINTENANCE);
}

export function sumRetailMaintenanceCents(entries: readonly LedgerEntry[]): number {
  return filterRetailMaintenanceEntries(entries).reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
}

export function countRetailMaintenanceEntries(
  entries: readonly LedgerEntry[],
): number {
  return filterRetailMaintenanceEntries(entries).length;
}

export function largestRetailMaintenanceAmountCents(
  entries: readonly LedgerEntry[],
): number {
  return filterRetailMaintenanceEntries(entries).reduce(
    (largest, entry) => Math.max(largest, entry.amountCents),
    0,
  );
}

// --- cross-category helpers ---

export function entriesInMonth(
  entries: readonly LedgerEntry[],
  monthPrefix: string,
): LedgerEntry[] {
  return entries.filter((entry) => entry.date.startsWith(monthPrefix));
}

export function totalCents(entries: readonly LedgerEntry[]): number {
  return entries.reduce((total, entry) => total + entry.amountCents, 0);
}

export function formatCents(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const remainder = String(cents % 100).padStart(2, "0");
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${grouped}.${remainder}`;
}

export function marchOfficeSuppliesTotalCents(): number {
  return sumOfficeSuppliesCents(entriesInMonth(LEDGER_ENTRIES, "2025-03"));
}

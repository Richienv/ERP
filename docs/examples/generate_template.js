const XLSX = require('xlsx');

const data = [
    {
        Step_Order: 1,
        Role: "Sales Manager",
        Action_Verb: "Create",
        Object: "Sales Order",
        Condition: "",
        Mapped_Module_Key: "MOD_SALES_01"
    },
    {
        Step_Order: 2,
        Role: "Warehouse Manager",
        Action_Verb: "Check Stock Verification",
        Object: "Stock Level",
        Condition: "",
        Mapped_Module_Key: "MOD_STOCK_01"
    },
    {
        Step_Order: 3,
        Role: "Warehouse Staff",
        Action_Verb: "Reserve",
        Object: "Stock",
        Condition: "Stock > 0",
        Mapped_Module_Key: "MOD_STOCK_02"
    },
    {
        Step_Order: 4,
        Role: "Accountant",
        Action_Verb: "Generate",
        Object: "Invoice",
        Condition: "",
        Mapped_Module_Key: "MOD_INVOICE_01"
    }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Workflow");
XLSX.writeFile(wb, "docs/examples/template.xlsx");

console.log("Template generated at docs/examples/template.xlsx");

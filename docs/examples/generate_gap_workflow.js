const XLSX = require('xlsx');

const data = [
    {
        Step_Order: 1,
        Role: "Manufacturing Manager",
        Action_Verb: "Create Production Order",
        Object: "Work Order",
        Condition: "Plan Approved",
        Data_Input: "BOM ID, Quantity",
        Mapped_Module_Key: "MOD_MANUFACTURING_01" // Assume this exists or will be standard
    },
    {
        Step_Order: 2,
        Role: "AI Agent",
        Action_Verb: "Verify Quality",
        Object: "Product Image",
        Condition: "Production Complete",
        Data_Input: "Camera Feed",
        Mapped_Module_Key: "MOD_AI_VISION_Check" // THIS IS A GAP (Does not exist in modules.json)
    },
    {
        Step_Order: 3,
        Role: "Warehouse Staff",
        Action_Verb: "Store Product",
        Object: "Inventory",
        Condition: "Quality Passed",
        Data_Input: "Location ID",
        Mapped_Module_Key: "MOD_STOCK_01"
    }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Gap Analysis Test");
XLSX.writeFile(wb, "docs/examples/gap_workflow.xlsx");

console.log("Gap Template generated at docs/examples/gap_workflow.xlsx");

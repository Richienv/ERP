const XLSX = require('xlsx');

// Define a complex workflow with both Standard Modules and Gaps
const data = [
    {
        Step_Order: 1,
        Role: "Sales Manager",
        Action_Verb: "Create",
        Object: "Quotation",
        Mapped_Module_Key: "SALES_QUOTATION_CREATE", // Correct Key
        Condition: "Customer Request",
        Data_Input: "Customer Details, Product List"
    },
    {
        Step_Order: 2,
        Role: "System",
        Action_Verb: "Check",
        Object: "StockLevel",
        Mapped_Module_Key: "INVENTORY_STOCK_LEVEL_CHECK", // Correct Key
        Condition: "Always",
        Data_Input: "Product ID"
    },
    {
        Step_Order: 3,
        Role: "Production Manager",
        Action_Verb: "Schedule",
        Object: "ProductionRun",
        Mapped_Module_Key: "MFG_Schedule_Run", // GAP (Intentional)
        Condition: "If Stock Low",
        Data_Input: "Bill of Materials, Deadline"
    },
    {
        Step_Order: 4,
        Role: "AI Assistant",
        Action_Verb: "Analyze",
        Object: "MarketTrend",
        Mapped_Module_Key: "AI_Analyze_Trend", // GAP (Intentional)
        Condition: "Optional",
        Data_Input: "Historical Sales Data"
    },
    {
        Step_Order: 5,
        Role: "Sales Manager",
        Action_Verb: "Confirm",
        Object: "SalesOrder",
        Mapped_Module_Key: "SALES_ORDER_CONFIRM", // Correct Key
        Condition: "Stock Available",
        Data_Input: "Quotation ID"
    },
    {
        Step_Order: 6,
        Role: "Warehouse Staff",
        Action_Verb: "Create",
        Object: "DeliveryOrder",
        Mapped_Module_Key: "INVENTORY_DELIVERY_ORDER_CREATE", // Correct Key
        Condition: "Order Confirmed",
        Data_Input: "Sales Order ID"
    },
    {
        Step_Order: 7,
        Role: "IoT Sensor",
        Action_Verb: "Track",
        Object: "FleetLocation",
        Mapped_Module_Key: "IOT_Track_Fleet", // GAP
        Condition: "During Delivery",
        Data_Input: "GPS Coordinates"
    },
    {
        Step_Order: 8,
        Role: "Finance",
        Action_Verb: "Create",
        Object: "Invoice",
        Mapped_Module_Key: "FINANCE_INVOICE_CREATE", // Correct Key
        Condition: "Delivery Complete",
        Data_Input: "Delivery Order ID"
    }
];

// Create Workbook
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(data);

// Adjust column widths for better readability (optional, for manual viewing)
const wscols = [
    { wch: 10 }, // Step_Order
    { wch: 20 }, // Role
    { wch: 15 }, // Action
    { wch: 20 }, // Object
    { wch: 30 }, // Module Key
    { wch: 20 }, // Condition
    { wch: 30 }  // Data Input
];
ws['!cols'] = wscols;

XLSX.utils.book_append_sheet(wb, ws, "End-to-End Workflow");

// Write file
XLSX.writeFile(wb, "docs/examples/comprehensive_workflow.xlsx");

console.log("Created docs/examples/comprehensive_workflow.xlsx");

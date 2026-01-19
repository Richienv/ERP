const XLSX = require('xlsx');

const data = [
    {
        Step_Order: 1,
        Role: "Sales Staff",
        Action_Verb: "Create Quotation",
        Object: "Quotation",
        Condition: "Customer Request",
        Data_Input: "Customer ID, Product List, Quantities",
        Mapped_Module_Key: "MOD_QUOTATION_01"
    },
    {
        Step_Order: 2,
        Role: "Sales Manager",
        Action_Verb: "Approve Sales Order",
        Object: "Sales Order",
        Condition: "Value > 10M",
        Data_Input: "Approval Code",
        Mapped_Module_Key: "MOD_SALES_02"
    },
    {
        Step_Order: 3,
        Role: "Warehouse Staff",
        Action_Verb: "Check Stock",
        Object: "Inventory",
        Condition: "Order Approved",
        Data_Input: "SKU List",
        Mapped_Module_Key: "MOD_STOCK_01"
    },
    {
        Step_Order: 4,
        Role: "Accountant",
        Action_Verb: "Receive Payment",
        Object: "Payment",
        Condition: "Stock Available",
        Data_Input: "Payment Proof, Amount",
        Mapped_Module_Key: "MOD_PAYMENT_01"
    },
    {
        Step_Order: 5,
        Role: "Warehouse Manager",
        Action_Verb: "Ship Order",
        Object: "Shipment",
        Condition: "Payment Received",
        Data_Input: "Tracking Number, Courier",
        Mapped_Module_Key: "MOD_STOCK_03"
    },
    {
        Step_Order: 6,
        Role: "Accountant",
        Action_Verb: "Generate Invoice",
        Object: "Invoice",
        Condition: "Shipped",
        Data_Input: "Order ID",
        Mapped_Module_Key: "MOD_INVOICE_01"
    }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Complex Workflow");
XLSX.writeFile(wb, "docs/examples/complex_workflow.xlsx");

console.log("Complex Template generated at docs/examples/complex_workflow.xlsx");

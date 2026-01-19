const XLSX = require('xlsx');

// Scenario: Procurement and Manufacturing (Mostly Gaps in current system)
const data = [
    {
        Step_Order: 1,
        Role: "IoT System",
        Action_Verb: "Analisa",
        Object: "Stok Rendah",
        Mapped_Module_Key: "IOT_DETECT_LOW_STOCK", // GAP
        Condition: "Sensor Trigger",
        Data_Input: "ID Sensor, Level Stok"
    },
    {
        Step_Order: 2,
        Role: "System",
        Action_Verb: "Cek",
        Object: "LevelStok",
        Mapped_Module_Key: "MOD_STOCK_01", // VALID (Matches "Cek Level Stok")
        Condition: "Verification",
        Data_Input: "ID SKU"
    },
    {
        Step_Order: 3,
        Role: "Purchasing Manager",
        Action_Verb: "Buat",
        Object: "PurchaseOrder",
        Mapped_Module_Key: "PROC_CREATE_PO", // GAP
        Condition: "Stok Dikonfirmasi Rendah",
        Data_Input: "Detail Vendor, Kuantitas"
    },
    {
        Step_Order: 4,
        Role: "Supplier",
        Action_Verb: "Kirim",
        Object: "Bahan Baku",
        Mapped_Module_Key: "EXT_SUPPLIER_DELIVER", // GAP
        Condition: "PO Diterima",
        Data_Input: "Surat Jalan"
    },
    {
        Step_Order: 5,
        Role: "Warehouse Staff",
        Action_Verb: "Terima",
        Object: "Penerimaan Barang",
        Mapped_Module_Key: "WH_RECEIVE_GRN", // GAP
        Condition: "Barang Tiba",
        Data_Input: "Nomor DO, Hitungan Fisik"
    },
    {
        Step_Order: 6,
        Role: "Quality Assurance",
        Action_Verb: "Inspeksi",
        Object: "Kualitas Material",
        Mapped_Module_Key: "QA_INSPECT_MATERIAL", // GAP
        Condition: "Sebelum Masuk",
        Data_Input: "Sampel Batch"
    },
    {
        Step_Order: 7,
        Role: "Production Manager",
        Action_Verb: "Jalankan",
        Object: "Produksi",
        Mapped_Module_Key: "MFG_EXECUTE_RUN", // GAP
        Condition: "Material Tersedia",
        Data_Input: "Resep/BOM"
    },
    {
        Step_Order: 8,
        Role: "Finance",
        Action_Verb: "Bayar",
        Object: "Faktur Vendor",
        Mapped_Module_Key: "FIN_PAY_VENDOR", // GAP
        Condition: "Invoice Diterima",
        Data_Input: "Detail Bank"
    }
];

// Create Workbook
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(data);

// Adjust column widths
const wscols = [
    { wch: 10 },
    { wch: 20 },
    { wch: 15 },
    { wch: 20 },
    { wch: 30 },
    { wch: 20 },
    { wch: 30 }
];
ws['!cols'] = wscols;

XLSX.utils.book_append_sheet(wb, ws, "Restock Workflow");

// Write file
XLSX.writeFile(wb, "docs/examples/supply_chain_workflow.xlsx");

console.log("Created docs/examples/supply_chain_workflow.xlsx");

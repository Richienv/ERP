
export type SystemLog = {
    id: string;
    timestamp: Date;
    level: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
    module: string;
    message: string;
    user: string;
    ipAddress: string;
};

export const mockSystemLogs: SystemLog[] = [
    {
        id: "LOG-001",
        timestamp: new Date("2024-11-21T09:15:00"),
        level: "INFO",
        module: "AUTH",
        message: "User login successful",
        user: "admin@perusahaan.com",
        ipAddress: "192.168.1.10"
    },
    {
        id: "LOG-002",
        timestamp: new Date("2024-11-21T09:20:00"),
        level: "WARNING",
        module: "INVENTORY",
        message: "Stock level below threshold for item PRD-001",
        user: "system",
        ipAddress: "localhost"
    },
    {
        id: "LOG-003",
        timestamp: new Date("2024-11-21T10:05:00"),
        level: "ERROR",
        module: "SALES",
        message: "Failed to generate invoice PDF: Timeout",
        user: "sales_manager",
        ipAddress: "192.168.1.15"
    },
    {
        id: "LOG-004",
        timestamp: new Date("2024-11-21T10:15:00"),
        level: "INFO",
        module: "PROCUREMENT",
        message: "PO-2024-089 approved",
        user: "procurement_head",
        ipAddress: "192.168.1.20"
    },
    {
        id: "LOG-005",
        timestamp: new Date("2024-11-21T11:00:00"),
        level: "CRITICAL",
        module: "DATABASE",
        message: "High connection latency detected (>500ms)",
        user: "system",
        ipAddress: "localhost"
    },
    {
        id: "LOG-006",
        timestamp: new Date("2024-11-21T11:30:00"),
        level: "INFO",
        module: "MANUFACTURING",
        message: "Work Order WO-101 completed",
        user: "operator_1",
        ipAddress: "192.168.1.50"
    },
    {
        id: "LOG-007",
        timestamp: new Date("2024-11-21T12:00:00"),
        level: "INFO",
        module: "FINANCE",
        message: "Daily journal posting automated task started",
        user: "system",
        ipAddress: "localhost"
    }
];

export const systemPerformanceData = [
    { time: "08:00", cpu: 15, memory: 40, requests: 120 },
    { time: "09:00", cpu: 25, memory: 45, requests: 350 },
    { time: "10:00", cpu: 45, memory: 60, requests: 890 },
    { time: "11:00", cpu: 35, memory: 55, requests: 650 },
    { time: "12:00", cpu: 30, memory: 50, requests: 400 },
    { time: "13:00", cpu: 40, memory: 58, requests: 720 },
    { time: "14:00", cpu: 55, memory: 65, requests: 950 },
];

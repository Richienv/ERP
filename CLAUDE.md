# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production application with Turbopack  
- `npm start` - Start production server
- `npm run lint` - Run ESLint for code quality checks

### Development Server
The development server runs on http://localhost:3000 by default.

## Architecture Overview

This is an Indonesian ERP (Enterprise Resource Planning) system built with Next.js 15, React 19, and TypeScript.

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **UI Library**: Radix UI components with shadcn/ui
- **Styling**: Tailwind CSS v4 with custom CSS variables
- **Icons**: Tabler Icons React and Lucide React
- **Charts**: Recharts for data visualization
- **Tables**: TanStack Table for data management
- **Drag & Drop**: DND Kit for interactive UI
- **Theme**: next-themes for dark/light mode support
- **Notifications**: Sonner for toast notifications
- **Validation**: Zod for schema validation

### Project Structure
```
app/
├── dashboard/          # Main dashboard page
├── finance/
│   └── chart-accounts/ # Financial chart of accounts
├── hcm/               # Human Capital Management
│   ├── employee-master/
│   ├── payroll/
│   └── attendance/
└── layout.tsx         # Root layout with Indonesian locale

components/
├── ui/                # Reusable UI components (shadcn/ui)
├── app-sidebar.tsx    # Main navigation sidebar
├── nav-*.tsx          # Navigation components
├── data-table.tsx     # Data table component
└── chart-*.tsx        # Chart components

lib/
└── utils.ts           # Utility functions (cn helper)
```

### Key Features
- **Modular ERP Structure**: Organized by business modules (Finance, HCM, Inventory, etc.)
- **Indonesian Language**: Interface uses Bahasa Indonesia
- **Responsive Design**: Mobile-first approach with sidebar collapsing
- **Component-Based UI**: Leverages Radix UI primitives with custom styling
- **Data Visualization**: Interactive charts and tables for business analytics

### Development Notes
- Uses TypeScript strict mode
- Path aliases configured with `@/*` pointing to root directory
- ESLint configured with Next.js and TypeScript rules
- CSS custom properties for theming and responsive design
- Font optimization with Geist fonts from Google Fonts

### Navigation Structure
The sidebar includes main sections for:
- Dashboard (Dasbor)
- Inventory (Inventori) 
- Sales & CRM (Penjualan & CRM)
- Procurement (Pengadaan)
- Finance (Keuangan)
- Manufacturing (Manufaktur)
- Human Resources (SDM)

Each module follows Indonesian naming conventions and business terminology.
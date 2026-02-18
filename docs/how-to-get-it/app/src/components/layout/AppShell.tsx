import { useState } from 'react';
import { 
  Package, 
  ShoppingCart, 
  Users, 
  LayoutDashboard, 
  Menu,
  Zap,
  Wifi,
  WifiOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { usePrefetchProducts } from '@/hooks/useProducts';
import { usePrefetchSalesOrders } from '@/hooks/useSalesOrders';
import { usePrefetchCustomers } from '@/hooks/useCustomers';
import { usePrefetchStats } from '@/hooks/useStats';

// ============================================
// APP SHELL PATTERN
// ============================================
// This is the core of instant-load ERP architecture
// 
// The App Shell loads ONCE and NEVER reloads:
// - Sidebar is always visible
// - Header is always visible  
// - Only the content area changes
// 
// This gives users the feeling of a desktop app,
// not a website that reloads on every click.
// ============================================

type ViewType = 'dashboard' | 'products' | 'sales' | 'customers';

interface AppShellProps {
  children: React.ReactNode;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
  prefetch: () => void;
}

export function AppShell({ children, currentView, onViewChange }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Real-time sync status
  const { isConnected } = useRealtimeSync();
  
  // Prefetch functions for each module
  const { prefetchProducts } = usePrefetchProducts();
  const { prefetchSalesOrders } = usePrefetchSalesOrders();
  const { prefetchCustomers } = usePrefetchCustomers();
  const { prefetchStats } = usePrefetchStats();

  // Navigation items with prefetch functions
  const navItems: NavItem[] = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      prefetch: prefetchStats,
    },
    { 
      id: 'products', 
      label: 'Products', 
      icon: Package,
      prefetch: () => prefetchProducts({ page: 1 }),
    },
    { 
      id: 'sales', 
      label: 'Sales Orders', 
      icon: ShoppingCart,
      prefetch: () => prefetchSalesOrders({ page: 1 }),
    },
    { 
      id: 'customers', 
      label: 'Customers', 
      icon: Users,
      prefetch: () => prefetchCustomers({ page: 1 }),
    },
  ];

  // Handle navigation with prefetching
  const handleNavClick = (item: NavItem) => {
    onViewChange(item.id);
  };

  // Handle mouse enter - PREFETCH MAGIC HAPPENS HERE
  const handleMouseEnter = (item: NavItem) => {
    // Start fetching data BEFORE user clicks
    // By the time they click, data is already in cache!
    item.prefetch();
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ==========================================
          SIDEBAR - NEVER RELOADS
          ========================================== */}
      <aside
        className={cn(
          'bg-slate-900 text-white transition-all duration-300 flex flex-col',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg">InstantERP</span>
            </div>
          ) : (
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mx-auto">
              <Zap className="w-5 h-5 text-white" />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              'p-1 rounded hover:bg-slate-700 transition-colors',
              !sidebarOpen && 'hidden'
            )}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              onMouseEnter={() => handleMouseEnter(item)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 transition-all duration-200',
                'hover:bg-slate-800 relative group',
                currentView === item.id && 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
              
              {/* Tooltip when collapsed */}
              {!sidebarOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
              
              {/* Active indicator */}
              {currentView === item.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400" />
              )}
            </button>
          ))}
        </nav>

        {/* Connection Status */}
        <div className="p-4 border-t border-slate-700">
          <div className={cn(
            'flex items-center gap-2 text-xs',
            sidebarOpen ? 'justify-start' : 'justify-center'
          )}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-400" />
                {sidebarOpen && <span className="text-green-400">Real-time sync active</span>}
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-yellow-400" />
                {sidebarOpen && <span className="text-yellow-400">Sync paused</span>}
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ==========================================
          MAIN CONTENT AREA
          ========================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - NEVER RELOADS */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-semibold text-gray-900">
              {navItems.find(i => i.id === currentView)?.label}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>System Online</span>
            </div>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
              JD
            </div>
          </div>
        </header>

        {/* Content - ONLY THIS CHANGES */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

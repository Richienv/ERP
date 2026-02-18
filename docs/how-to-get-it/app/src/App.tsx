import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardView } from '@/components/views/DashboardView';
import { ProductsView } from '@/components/views/ProductsView';
import { SalesOrdersView } from '@/components/views/SalesOrdersView';
import { CustomersView } from '@/components/views/CustomersView';
import { Toaster } from '@/components/ui/sonner';

// ============================================
// MAIN APP COMPONENT
// ============================================
// This is the entry point that implements:
// - App Shell pattern (sidebar/header never reload)
// - View switching without page reload
// - All data is cached and prefetched
// ============================================

type ViewType = 'dashboard' | 'products' | 'sales' | 'customers';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  // Render the appropriate view based on current selection
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'products':
        return <ProductsView />;
      case 'sales':
        return <SalesOrdersView />;
      case 'customers':
        return <CustomersView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <>
      <AppShell 
        currentView={currentView} 
        onViewChange={setCurrentView} 
      >
        {renderView()}
      </AppShell>
      <Toaster position="top-right" />
    </>
  );
}

export default App;

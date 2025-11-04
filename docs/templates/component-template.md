# Template Dokumentasi Komponen

## 📋 Informasi Komponen

| **Aspek** | **Detail** |
|-----------|------------|
| **Nama Komponen** | [NamaKomponen] |
| **File Path** | `components/[module]/[NamaKomponen].tsx` |
| **Tipe** | [UI Component/Business Component/Layout Component] |
| **Versi** | [1.0.0] |
| **Tanggal Dibuat** | [YYYY-MM-DD] |
| **Developer** | [Nama Developer] |
| **Status** | [Draft/In Development/Completed/Deprecated] |

---

## 🎯 Tujuan Komponen

**Deskripsi:**
[Jelaskan tujuan dan fungsi utama komponen ini dalam 2-3 kalimat]

**Use Cases:**
- [Use case 1]
- [Use case 2]
- [Use case 3]

---

## 🔧 API Reference

### Props Interface

```typescript
interface [NamaKomponen]Props {
  // Required props
  data: [DataType][]              // Deskripsi data yang diperlukan
  onAction: (item: [DataType]) => void  // Callback function
  
  // Optional props
  title?: string                  // Judul komponen (default: "")
  loading?: boolean              // Loading state (default: false)
  className?: string             // Custom CSS classes
  variant?: 'default' | 'compact' | 'expanded'  // Style variant
  
  // Event handlers
  onEdit?: (id: string) => void  // Edit callback
  onDelete?: (id: string) => void // Delete callback
  onSort?: (field: string, direction: 'asc' | 'desc') => void
}
```

### Default Props

```typescript
const defaultProps: Partial<[NamaKomponen]Props> = {
  title: "",
  loading: false,
  variant: 'default',
  className: ""
}
```

---

## 💡 Penggunaan

### Basic Usage

```tsx
import { [NamaKomponen] } from '@/components/[module]/[NamaKomponen]'

function ParentComponent() {
  const handleAction = (item: DataType) => {
    console.log('Action triggered:', item)
  }

  return (
    <[NamaKomponen]
      data={data}
      onAction={handleAction}
      title="Daftar [Entity]"
    />
  )
}
```

### Advanced Usage

```tsx
import { [NamaKomponen] } from '@/components/[module]/[NamaKomponen]'

function AdvancedExample() {
  const [data, setData] = useState<DataType[]>([])
  const [loading, setLoading] = useState(false)

  const handleEdit = (id: string) => {
    // Logic untuk edit
  }

  const handleDelete = (id: string) => {
    // Logic untuk delete
  }

  return (
    <[NamaKomponen]
      data={data}
      loading={loading}
      variant="expanded"
      title="Manajemen [Entity]"
      onEdit={handleEdit}
      onDelete={handleDelete}
      className="custom-styling"
    />
  )
}
```

---

## 🎨 Styling & Variants

### CSS Classes

```css
/* Main component classes */
.[nama-komponen] {
  /* Base styling */
}

.[nama-komponen]--default {
  /* Default variant styling */
}

.[nama-komponen]--compact {
  /* Compact variant styling */
}

.[nama-komponen]--expanded {
  /* Expanded variant styling */
}

/* State classes */
.[nama-komponen]--loading {
  /* Loading state styling */
}

.[nama-komponen]--empty {
  /* Empty state styling */
}
```

### Tailwind Classes

```typescript
const variants = {
  default: "bg-white border border-gray-200 rounded-lg shadow-sm",
  compact: "bg-white border border-gray-200 rounded-md p-2",
  expanded: "bg-white border border-gray-200 rounded-lg shadow-lg p-6"
}
```

### Theme Integration

```typescript
// Menggunakan CSS variables dari theme
const styles = {
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
  borderColor: 'var(--border)'
}
```

---

## 🔄 State Management

### Internal State

```typescript
const [NamaKomponen] = ({ data, loading, ...props }) => {
  // Local state
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  const [filterValue, setFilterValue] = useState("")

  // Effects
  useEffect(() => {
    // Side effects
  }, [data])

  // Event handlers
  const handleSelection = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  // Render logic
  return (
    // JSX
  )
}
```

### External State Integration

```typescript
// Menggunakan dengan Context
const { state, dispatch } = useContext([Module]Context)

// Menggunakan dengan Custom Hooks
const { data, loading, error, mutate } = use[Module]Data()

// Menggunakan dengan React Query
const { data, isLoading, error } = useQuery({
  queryKey: ['[module]', filters],
  queryFn: () => fetch[Module]Data(filters)
})
```

---

## 🎭 Event Handling

### Event Types

```typescript
// Custom event types
type [NamaKomponen]Event = {
  type: 'select' | 'edit' | 'delete' | 'sort' | 'filter'
  payload: {
    id?: string
    data?: any
    field?: string
    value?: any
  }
}

// Event handler signatures
type EventHandler = (event: [NamaKomponen]Event) => void
```

### Event Examples

```typescript
// Selection event
const handleSelect = (id: string) => {
  onEvent?.({
    type: 'select',
    payload: { id }
  })
}

// Sort event
const handleSort = (field: string, direction: 'asc' | 'desc') => {
  onEvent?.({
    type: 'sort',
    payload: { field, value: direction }
  })
}
```

---

## 📱 Responsive Behavior

### Breakpoints

```typescript
const breakpoints = {
  mobile: 'max-w-sm',      // < 640px
  tablet: 'max-w-md',      // 640px - 768px  
  desktop: 'max-w-lg',     // > 768px
}
```

### Responsive Implementation

```tsx
const [NamaKomponen] = ({ ...props }) => {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const isTablet = useMediaQuery('(max-width: 768px)')

  return (
    <div className={cn(
      'base-classes',
      isMobile && 'mobile-classes',
      isTablet && 'tablet-classes'
    )}>
      {isMobile ? <MobileView /> : <DesktopView />}
    </div>
  )
}
```

---

## ♿ Accessibility

### ARIA Attributes

```tsx
<div
  role="table"
  aria-label="[Deskripsi tabel]"
  aria-describedby="table-description"
>
  <div role="row" aria-selected={isSelected}>
    <div role="cell" aria-label="[Label cell]">
      {content}
    </div>
  </div>
</div>
```

### Keyboard Navigation

```typescript
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Enter':
    case ' ':
      // Trigger action
      break
    case 'ArrowUp':
    case 'ArrowDown':
      // Navigation
      break
    case 'Escape':
      // Close/cancel
      break
  }
}
```

### Screen Reader Support

```tsx
<div>
  <span className="sr-only">
    [Deskripsi untuk screen reader]
  </span>
  <div aria-live="polite">
    {statusMessage}
  </div>
</div>
```

---

## 🧪 Testing

### Unit Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { [NamaKomponen] } from './[NamaKomponen]'

describe('[NamaKomponen]', () => {
  const mockData = [
    // Mock data
  ]

  it('renders correctly with data', () => {
    render(<[NamaKomponen] data={mockData} onAction={jest.fn()} />)
    
    expect(screen.getByText('[Expected text]')).toBeInTheDocument()
  })

  it('handles click events', () => {
    const mockOnAction = jest.fn()
    render(<[NamaKomponen] data={mockData} onAction={mockOnAction} />)
    
    fireEvent.click(screen.getByText('[Clickable element]'))
    expect(mockOnAction).toHaveBeenCalledWith(/* expected args */)
  })

  it('displays loading state', () => {
    render(<[NamaKomponen] data={[]} loading={true} onAction={jest.fn()} />)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
```

### Integration Tests

```typescript
import { renderWithProviders } from '@/test-utils'
import { [NamaKomponen] } from './[NamaKomponen]'

describe('[NamaKomponen] Integration', () => {
  it('integrates with data provider', async () => {
    const { store } = renderWithProviders(
      <[NamaKomponen] onAction={jest.fn()} />
    )

    // Test integration logic
  })
})
```

---

## 🚨 Error Handling

### Error Boundaries

```tsx
const [NamaKomponen] = ({ data, onError, ...props }) => {
  const [error, setError] = useState<Error | null>(null)

  if (error) {
    return (
      <ErrorFallback 
        error={error} 
        resetError={() => setError(null)}
      />
    )
  }

  try {
    // Component logic
    return (
      // Normal render
    )
  } catch (err) {
    setError(err as Error)
    onError?.(err as Error)
    return null
  }
}
```

### Error States

```tsx
// Empty state
if (!data || data.length === 0) {
  return (
    <EmptyState 
      title="Tidak ada data"
      description="Belum ada [entity] yang dibuat"
      action={<Button>Tambah [Entity]</Button>}
    />
  )
}

// Error state
if (error) {
  return (
    <ErrorState
      title="Terjadi kesalahan"
      description={error.message}
      onRetry={handleRetry}
    />
  )
}
```

---

## ⚡ Performance

### Optimization Techniques

```typescript
// Memoization
const [NamaKomponen] = memo(({ data, ...props }) => {
  const memoizedData = useMemo(() => 
    processData(data), [data]
  )

  const memoizedCallback = useCallback((id: string) => {
    // Callback logic
  }, [dependency])

  return (
    // Render
  )
})

// Custom comparison
const [NamaKomponen] = memo(Component, (prevProps, nextProps) => {
  return prevProps.data.length === nextProps.data.length &&
         prevProps.loading === nextProps.loading
})
```

### Lazy Loading

```typescript
// Lazy load heavy components
const HeavyComponent = lazy(() => import('./HeavyComponent'))

const [NamaKomponen] = ({ showHeavy, ...props }) => {
  return (
    <div>
      {/* Light components */}
      {showHeavy && (
        <Suspense fallback={<LoadingSkeleton />}>
          <HeavyComponent />
        </Suspense>
      )}
    </div>
  )
}
```

---

## 🔧 Configuration

### Environment Variables

```typescript
// Component-specific config
const config = {
  itemsPerPage: Number(process.env.NEXT_PUBLIC_ITEMS_PER_PAGE) || 10,
  maxItems: Number(process.env.NEXT_PUBLIC_MAX_ITEMS) || 1000,
  enableFeatureX: process.env.NEXT_PUBLIC_ENABLE_FEATURE_X === 'true'
}
```

### Feature Flags

```typescript
const [NamaKomponen] = ({ features, ...props }) => {
  const { isEnabled } = useFeatureFlag()

  return (
    <div>
      {/* Base functionality */}
      {isEnabled('advanced-features') && (
        <AdvancedFeatures />
      )}
    </div>
  )
}
```

---

## 📦 Dependencies

### Internal Dependencies

```typescript
// UI Components
import { Button } from '@/components/ui/button'
import { Table } from '@/components/ui/table'
import { Loading } from '@/components/ui/loading'

// Hooks
import { use[Module]Data } from '@/hooks/use[module]-data'
import { useMediaQuery } from '@/hooks/use-media-query'

// Utils
import { cn } from '@/lib/utils'
import { format[Entity] } from '@/lib/[module]-utils'
```

### External Dependencies

```json
{
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "optionalDependencies": {
    "framer-motion": "^10.0.0"
  }
}
```

---

## 📝 Change Log

| **Version** | **Date** | **Changes** | **Developer** |
|-------------|----------|-------------|---------------|
| 1.0.0 | YYYY-MM-DD | Initial component creation | [Nama] |
| 1.0.1 | YYYY-MM-DD | Added responsive support | [Nama] |
| 1.1.0 | YYYY-MM-DD | Added new variant | [Nama] |

---

## 🔗 Related Components

- [`[RelatedComponent1]`](./[RelatedComponent1].md) - [Deskripsi relasi]
- [`[RelatedComponent2]`](./[RelatedComponent2].md) - [Deskripsi relasi]

---

## 📞 Support

### Issues & Questions
- **GitHub Issues:** [Link ke issues]
- **Primary Maintainer:** [Nama] - [Email]
- **Documentation:** [Link ke docs]

---

**Template ini harus digunakan untuk mendokumentasikan setiap komponen yang dibuat.**

*Terakhir diupdate: [Tanggal]*
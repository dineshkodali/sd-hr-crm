# Performance Optimization Plan - Immediate Actions

## Priority 1: Database Optimization (Backend)

### 1.1 Add Missing Indexes
**Impact**: 50-80% faster queries
**Files**: `Backend/scripts/add_performance_indexes.sql`

```sql
-- Foreign key indexes (critical for JOINs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_users_hotel_id ON service_users(hotel_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_users_property_id ON service_users(property_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_users_room_id ON service_users(room_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_users_status ON service_users(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_hotel_id ON rooms(hotel_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_property_id ON rooms(property_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_property_id ON incidents(property_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_property_id ON maintenance(property_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_status ON maintenance(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_priority ON maintenance(priority);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compliance_property_id ON compliance(property_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compliance_status ON compliance(status);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_users_status_property ON service_users(status, property_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_status_created ON incidents(status, created_at DESC);
```

### 1.2 Optimize Database Connection Pool
**Impact**: Better concurrency, fewer timeouts
**File**: `Backend/config/db.js`

```javascript
const poolTuning = {
  max: 20, // Increase from 10 to 20
  min: 5, // Add minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Reduce from 20s to 10s
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  allowExitOnIdle: false
};
```

## Priority 2: Backend API Optimization

### 2.1 Add Pagination to All List Endpoints
**Impact**: 70-90% faster response times
**Files**: All route files

**Pattern to implement**:
```javascript
// Add to all GET list endpoints
router.get('/api/service-users', protect, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100
  const offset = (page - 1) * limit;
  
  // Add filters
  const status = req.query.status;
  const search = req.query.search;
  
  let whereClause = 'WHERE 1=1';
  const params = [];
  let paramCount = 1;
  
  if (status && status !== 'all') {
    whereClause += ` AND status = $${paramCount++}`;
    params.push(status);
  }
  
  if (search) {
    whereClause += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
    params.push(`%${search}%`);
    paramCount++;
  }
  
  // Get total count
  const countQuery = `SELECT COUNT(*) FROM service_users ${whereClause}`;
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Get paginated data
  params.push(limit, offset);
  const dataQuery = `
    SELECT su.*, h.name as hotel_name, r.room_number
    FROM service_users su
    LEFT JOIN hotels h ON h.id = su.hotel_id
    LEFT JOIN rooms r ON r.id = su.room_id
    ${whereClause}
    ORDER BY su.created_at DESC
    LIMIT $${paramCount++} OFFSET $${paramCount}
  `;
  
  const result = await pool.query(dataQuery, params);
  
  res.json({
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + limit < total
    }
  });
});
```

### 2.2 Optimize SELECT Queries - Only Fetch Needed Columns
**Impact**: 40-60% less data transfer

```javascript
// Instead of SELECT *
SELECT su.id, su.first_name, su.last_name, su.status, su.admission_date,
       h.name as hotel_name, r.room_number
FROM service_users su
LEFT JOIN hotels h ON h.id = su.hotel_id
LEFT JOIN rooms r ON r.id = su.room_id
```

### 2.3 Add Batch Endpoints for Dashboard
**Impact**: 80% fewer HTTP requests
**File**: `Backend/routes/dashboard.js`

```javascript
// Single endpoint that returns all dashboard data
router.get('/api/dashboard/batch', protect, async (req, res) => {
  try {
    const [kpis, trends, occupancy, incidents, maintenance] = await Promise.all([
      getKPIs(req.user),
      getTrends(req.user),
      getOccupancy(req.user),
      getRecentIncidents(req.user),
      getMaintenanceStats(req.user)
    ]);
    
    res.json({ kpis, trends, occupancy, incidents, maintenance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Priority 3: Frontend Optimization

### 3.1 Implement Pagination in Frontend
**Impact**: Instant page loads
**Files**: All list pages

```javascript
const [pagination, setPagination] = useState({
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0
});

const fetchUsers = async (page = 1) => {
  setLoading(true);
  try {
    const res = await api.get('/api/service-users', {
      params: {
        page,
        limit: pagination.limit,
        status: statusFilter,
        search: search
      }
    });
    
    setUsers(res.data.data);
    setPagination(res.data.pagination);
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};

// Pagination controls
<div className="flex justify-between items-center mt-4">
  <button 
    disabled={pagination.page === 1}
    onClick={() => fetchUsers(pagination.page - 1)}
  >
    Previous
  </button>
  <span>Page {pagination.page} of {pagination.totalPages}</span>
  <button 
    disabled={!pagination.hasMore}
    onClick={() => fetchUsers(pagination.page + 1)}
  >
    Next
  </button>
</div>
```

### 3.2 Implement Virtual Scrolling for Large Lists
**Impact**: Render only visible items
**Library**: react-window or react-virtualized

```javascript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={users.length}
  itemSize={120}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <UserCard user={users[index]} />
    </div>
  )}
</FixedSizeList>
```

### 3.3 Add Request Debouncing for Search
**Impact**: Fewer API calls

```javascript
import { useCallback } from 'react';
import debounce from 'lodash/debounce';

const debouncedSearch = useCallback(
  debounce((searchTerm) => {
    fetchUsers(1, searchTerm);
  }, 500),
  []
);

const handleSearchChange = (e) => {
  setSearch(e.target.value);
  debouncedSearch(e.target.value);
};
```

### 3.4 Use React Query for Data Fetching
**Impact**: Automatic caching, background refetch
**File**: New wrapper around axios

```javascript
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['service-users', page, statusFilter, search],
  queryFn: () => fetchServiceUsers({ page, statusFilter, search }),
  staleTime: 30000, // 30 seconds
  cacheTime: 300000, // 5 minutes
  keepPreviousData: true
});
```

## Priority 4: Caching Strategy

### 4.1 Add Redis for Backend Caching (Optional but Recommended)
**Impact**: 90% faster for repeated queries

```javascript
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Cache wrapper
async function getCached(key, fetchFn, ttl = 300) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetchFn();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
}

// Usage
const hotels = await getCached(
  `hotels:user:${userId}`,
  () => pool.query('SELECT * FROM hotels WHERE manager_id = $1', [userId]),
  300 // 5 minutes
);
```

### 4.2 Improve Frontend Cache Strategy
**Impact**: Instant navigation between pages

```javascript
// In axiosConfig.js - increase cache TTL for static data
const CACHE_TTLS = {
  hotels: 300000, // 5 minutes
  properties: 300000,
  users: 60000, // 1 minute
  dashboard: 30000 // 30 seconds
};
```

## Priority 5: Code Splitting & Lazy Loading

### 5.1 Lazy Load Routes
**Impact**: Faster initial page load

```javascript
// In App.jsx
import { lazy, Suspense } from 'react';

const ServiceUsersList = lazy(() => import('./pages/ServiceUsersList'));
const HotelsList = lazy(() => import('./pages/HotelsList'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/service-users" element={<ServiceUsersList />} />
    <Route path="/hotels" element={<HotelsList />} />
    <Route path="/dashboard" element={<AdminDashboard />} />
  </Routes>
</Suspense>
```

## Implementation Order

1. **Day 1**: Add database indexes (immediate 50-80% improvement)
2. **Day 2**: Add pagination to top 5 slowest endpoints
3. **Day 3**: Implement frontend pagination for those pages
4. **Day 4**: Add batch dashboard endpoint
5. **Day 5**: Optimize remaining endpoints

## Monitoring & Validation

Add performance monitoring:
```javascript
// Backend middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.url} took ${duration}ms`);
    }
  });
  next();
});
```

## Expected Results

- **Initial page load**: 5-10 seconds → 0.5-1 second
- **List pages**: 3-8 seconds → 0.3-0.8 seconds
- **Dashboard**: 8-15 seconds → 1-2 seconds
- **Search/filter**: 2-5 seconds → 0.2-0.5 seconds

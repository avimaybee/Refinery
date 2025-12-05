# Database Patterns Reference

## Indexing Strategies

### B-Tree Indexes (Default)
```sql
-- Single column
CREATE INDEX idx_users_email ON users(email);

-- Composite (order matters: left-to-right)
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC);

-- Partial (conditional index)
CREATE INDEX idx_active_users ON users(email) WHERE deleted_at IS NULL;
```

### When to Index
- Foreign keys (always)
- Columns in WHERE clauses
- Columns in ORDER BY
- Columns in JOIN conditions

### When NOT to Index
- Small tables (<1000 rows)
- Columns with low cardinality (boolean, status with few values)
- Frequently updated columns
- Write-heavy tables

## Query Optimization

### EXPLAIN ANALYZE
```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123 AND status = 'pending';

-- Look for:
-- ✓ Index Scan (good)
-- ✗ Seq Scan on large tables (bad)
-- ✗ Nested Loop with large outer set (bad)
```

### Common Optimizations

```sql
-- BAD: Function on indexed column
SELECT * FROM users WHERE LOWER(email) = 'test@example.com';

-- GOOD: Store normalized, or use expression index
CREATE INDEX idx_users_email_lower ON users(LOWER(email));

-- BAD: OR conditions
SELECT * FROM orders WHERE status = 'pending' OR status = 'processing';

-- GOOD: Use IN
SELECT * FROM orders WHERE status IN ('pending', 'processing');

-- BAD: LIKE with leading wildcard
SELECT * FROM products WHERE name LIKE '%phone%';

-- GOOD: Full-text search
SELECT * FROM products WHERE to_tsvector(name) @@ to_tsquery('phone');
```

## Connection Pooling

### Pool Sizing Formula
```
connections = (core_count * 2) + effective_spindle_count
```

For SSD: `connections ≈ core_count * 2 + 1`

### Configuration (PostgreSQL + Node.js)
```typescript
const pool = new Pool({
  host: process.env.DB_HOST,
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500,  // Close after N queries (prevents memory leaks)
});

// Health check
pool.on('error', (err) => {
  logger.error('Unexpected pool error', err);
  process.exit(-1);
});
```

## Transaction Patterns

### Isolation Levels
| Level | Dirty Read | Non-Repeatable Read | Phantom Read |
|-------|------------|---------------------|--------------|
| READ UNCOMMITTED | Yes | Yes | Yes |
| READ COMMITTED | No | Yes | Yes |
| REPEATABLE READ | No | No | Yes |
| SERIALIZABLE | No | No | No |

**Default recommendation**: READ COMMITTED with explicit locking when needed.

### Optimistic Locking
```sql
-- Add version column
ALTER TABLE orders ADD COLUMN version INTEGER DEFAULT 1;

-- Update with version check
UPDATE orders 
SET status = 'shipped', version = version + 1 
WHERE id = 123 AND version = 5;

-- If rows_affected = 0, conflict detected → retry or error
```

### Deadlock Prevention
1. Acquire locks in consistent order (e.g., by ID ascending)
2. Keep transactions short
3. Use `SELECT ... FOR UPDATE NOWAIT` to fail fast

## Pagination

### Offset Pagination (Simple, not for large datasets)
```sql
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 100;
-- Problem: OFFSET scans and discards rows (O(n))
```

### Cursor/Keyset Pagination (Recommended)
```sql
-- First page
SELECT * FROM posts ORDER BY created_at DESC, id DESC LIMIT 20;

-- Next page (using last item's values)
SELECT * FROM posts 
WHERE (created_at, id) < ('2024-01-15 12:00:00', 1234)
ORDER BY created_at DESC, id DESC 
LIMIT 20;
```

## Soft Deletes

```sql
-- Schema
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;

-- Query (exclude deleted)
SELECT * FROM users WHERE deleted_at IS NULL;

-- Soft delete
UPDATE users SET deleted_at = NOW() WHERE id = 123;

-- Restore
UPDATE users SET deleted_at = NULL WHERE id = 123;

-- Hard delete (cleanup job)
DELETE FROM users WHERE deleted_at < NOW() - INTERVAL '90 days';
```

## Database Migrations

### Best Practices
1. **Always reversible**: Every UP has a DOWN
2. **Atomic**: One logical change per migration
3. **Idempotent**: Safe to run multiple times
4. **No data loss**: Add columns nullable first, backfill, then add constraint

### Zero-Downtime Migrations
```sql
-- Step 1: Add nullable column (no lock)
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Step 2: Backfill in batches (application code)
UPDATE users SET phone = '' WHERE phone IS NULL LIMIT 1000;

-- Step 3: Add NOT NULL (after backfill complete)
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
```

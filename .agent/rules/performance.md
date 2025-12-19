# Performance & Complexity Optimization

## Algorithm Complexity Rules

- **Prefer O(1) and O(log n) over O(n)** whenever possible through memoization, caching, or data structure choice
- **Avoid O(n²) and higher** - use Maps, Sets, or proper indexing instead of nested loops
- **Cache expensive computations** - store results of repeated calculations
- **Use appropriate data structures**:
  - `Map` for key-value lookups (O(1)) instead of `Array.find()` (O(n))
  - `Set` for membership checks (O(1)) instead of `Array.includes()` (O(n))
  - Binary search on sorted arrays (O(log n)) instead of linear search (O(n))
- **Avoid repeated array operations in loops**:

  ```ts
  // ❌ O(n²) - Array.includes inside loop
  for (const item of items) {
    if (existingIds.includes(item.id)) {
      /* ... */
    }
  }

  // ✅ O(n) - Use Set for O(1) lookups
  const existingIdsSet = new Set(existingIds);
  for (const item of items) {
    if (existingIdsSet.has(item.id)) {
      /* ... */
    }
  }
  ```

- **Batch operations** instead of making multiple passes:

  ```ts
  // ❌ Multiple O(n) passes
  const filtered = items.filter((x) => x.active);
  const mapped = filtered.map((x) => x.value);
  const sum = mapped.reduce((a, b) => a + b, 0);

  // ✅ Single O(n) pass
  const sum = items.reduce((acc, x) => (x.active ? acc + x.value : acc), 0);
  ```

- **Early termination** - use `Array.some()`, `Array.every()`, or break loops early when possible
- **Lazy evaluation** - avoid computing values that may not be needed
- **Document complexity** - add comments for non-trivial algorithms: `// O(n log n) - sort + binary search`

## Memory Optimization

- Avoid creating unnecessary intermediate arrays/objects in loops
- Use generators (`function*`) for large data sets that don't need full materialization
- Stream large files instead of loading entirely into memory
- Clear references to large objects when no longer needed

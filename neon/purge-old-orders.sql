-- Retention: keep only the current Africa/Tunis calendar month.
-- Prefer the app helper `purgeOldOrders()` so open orders restore size stock first.

-- Preview cutoff (Tunis month start):
-- SELECT date_trunc('month', now() AT TIME ZONE 'Africa/Tunis') AT TIME ZONE 'Africa/Tunis' AS cutoff;

-- Preview rows that would be deleted:
-- SELECT id, status, created_at
-- FROM orders
-- WHERE created_at < (date_trunc('month', now() AT TIME ZONE 'Africa/Tunis') AT TIME ZONE 'Africa/Tunis')
-- ORDER BY created_at;

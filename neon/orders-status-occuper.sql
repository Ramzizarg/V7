-- Manual order statuses: pending | occuper | rejected
-- (shipped / out_for_delivery / delivered stay for Calirex pipeline)

UPDATE orders SET status = 'pending' WHERE lower(status) = 'confirmed';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
ADD CONSTRAINT orders_status_check
CHECK (
  status = ANY (
    ARRAY[
      'pending'::text,
      'occuper'::text,
      'rejected'::text,
      'delivered'::text,
      'out_for_delivery'::text,
      'shipped'::text
    ]
  )
);

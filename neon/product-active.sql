-- Run once on Neon (same DB as storefront): product visibility on the shop.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN products.active IS 'When false, product appears as coming soon on the storefront; no purchase.';


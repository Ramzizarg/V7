-- Run in Neon once: second color for a product (optional).
-- After this, the dashboard "Couleur 2" and storefront two swatches are active.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS color_id_2 integer REFERENCES colors (id) ON DELETE SET NULL;

COMMENT ON COLUMN products.color_id_2 IS 'Optional second color; pairs with color_id.';

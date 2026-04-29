-- Exemples : couleurs + catégories (Neon / PostgreSQL)
-- Exécuter dans le SQL Editor Neon après création des tables `colors` et `categories`
-- Colonnes attendues :
--   colors   : name, slug, hex
--   categories : name, slug, sort_order (optionnel — retirez sort_order si absent)

INSERT INTO colors (name, slug, hex)
SELECT v.name, v.slug, v.hex
FROM (
  VALUES
    ('Rouge', 'rouge', '#ef4444'),
    ('Jaune', 'jaune', '#eab308'),
    ('Bleu', 'bleu', '#3b82f6'),
    ('Vert', 'vert', '#22c55e'),
    ('Orange', 'orange', '#f97316'),
    ('Violet', 'violet', '#a855f7'),
    ('Rose', 'rose', '#ec4899'),
    ('Noir', 'noir', '#171717'),
    ('Blanc', 'blanc', '#fafafa'),
    ('Gris', 'gris', '#71717a'),
    ('Marron', 'marron', '#92400e'),
    ('Beige', 'beige', '#d4c4a8'),
    ('Turquoise', 'turquoise', '#14b8a6'),
    ('Bordeaux', 'bordeaux', '#7f1d1d'),
    ('Marine', 'marine', '#1e3a8a')
) AS v(name, slug, hex)
WHERE NOT EXISTS (
  SELECT 1 FROM colors c WHERE c.slug = v.slug
);

-- -----------------------------------------------------------------------------
-- Catégories d'exemple (noms en français, slugs URL)
-- -----------------------------------------------------------------------------

INSERT INTO categories (name, slug, sort_order)
SELECT v.name, v.slug, v.sort_order
FROM (
  VALUES
    ('Maillots & jerseys', 'maillots-jerseys', 40),
    ('T-shirts', 't-shirts', 50),
    ('Shorts', 'shorts', 60),
    ('Pantalons & joggings', 'pantalons-joggings', 70),
    ('Vestes', 'vestes', 80),
    ('Accessoires', 'accessoires', 90),
    ('Soldes', 'soldes', 100)
) AS v(name, slug, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.slug = v.slug
);

-- Si votre table `categories` n'a pas la colonne `sort_order`, utilisez plutôt :
--
-- INSERT INTO categories (name, slug)
-- SELECT v.name, v.slug
-- FROM (
--   VALUES
--     ('Hommes', 'hommes'),
--     ('Femmes', 'femmes'),
--     ...
-- ) AS v(name, slug)
-- WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = v.slug);

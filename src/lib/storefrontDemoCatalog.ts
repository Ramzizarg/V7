import { slugifyProductName } from "@/lib/productUrl";
import type { Product, StorefrontCategory } from "@/lib/types";

const now = () => new Date().toISOString();

/**
 * Données de démonstration quand aucune URL Postgres (Neon) n'est configurée.
 * Permet au site vitrine de rester navigable en local / preview sans `DATABASE_URL`.
 */
export function getStorefrontDemoProducts(): Product[] {
  const items: Product[] = [
    {
      id: 1,
      name: "Sweat a capuche zip integral",
      slug: "sweat-a-capuche-zip-integral",
      description: "Essentiel sport — demo sans base de donnees.",
      price: 189,
      stock: 12,
      category_id: 1,
      category_name: "Hoodies",
      images: ["/V7/2.jpeg"],
      created_at: now(),
      discount_price: null,
      sizes: ["S", "M", "L", "XL"],
      color: "Noir",
      color_hex: "#171717",
    },
    {
      id: 2,
      name: "T-shirt technique respirant",
      slug: "t-shirt-technique-respirant",
      description: null,
      price: 79,
      stock: 8,
      category_id: 2,
      category_name: "T-shirts",
      images: ["/V7/3.jpeg"],
      created_at: now(),
      discount_price: 69,
      sizes: ["XS", "S", "M", "L", "XL"],
      color: "Blanc",
      color_hex: "#fafafa",
    },
    {
      id: 3,
      name: "Short d'entrainement leger",
      slug: "short-d-entrainement-leger",
      description: null,
      price: 69,
      stock: 0,
      category_id: 3,
      category_name: "Shorts",
      images: ["/V7/4.jpeg"],
      created_at: now(),
      discount_price: null,
      sizes: ["S", "M", "L"],
      color: "Gris",
      color_hex: "#a1a1aa",
    },
    {
      id: 4,
      name: "Jogging slim confort",
      slug: "jogging-slim-confort",
      description: null,
      price: 149,
      stock: 5,
      category_id: 4,
      category_name: "Joggers",
      images: ["/V7/1.jpg"],
      created_at: now(),
      discount_price: null,
      sizes: ["S", "M", "L", "XL", "XXL"],
      color: "Marine",
      color_hex: "#1e3a5f",
    },
  ];
  return items;
}

export function getStorefrontDemoCategories(): StorefrontCategory[] {
  const products = getStorefrontDemoProducts();
  const byName = new Map<string, { name: string; image: string }>();
  for (const p of products) {
    const name = p.category_name?.trim() || "Essentiels";
    if (!byName.has(name)) {
      byName.set(name, { name, image: p.images[0] ?? "/V7/2.jpeg" });
    }
  }
  let nextId = 1;
  return [...byName.values()].map((c) => {
    const rowId = nextId++;
    return {
      id: rowId,
      name: c.name,
      slug: slugifyProductName(c.name) || `categorie-${rowId}`,
      sort_order: 0,
      image: c.image,
    };
  });
}

export function findDemoProductBySlug(rawSlug: string): Product | null {
  const slug = decodeURIComponent(rawSlug).trim();
  if (!slug) return null;
  const products = getStorefrontDemoProducts();

  const idPref = /^id-(\d+)$/.exec(slug);
  if (idPref) {
    const id = Number(idPref[1]);
    return products.find((p) => p.id === id) ?? null;
  }

  const bySlug = products.find((p) => (p.slug ?? "").toLowerCase() === slug.toLowerCase());
  if (bySlug) return bySlug;

  const byNameSlug = products.find((p) => slugifyProductName(p.name) === slug);
  if (byNameSlug) return byNameSlug;

  if (/^\d+$/.test(slug)) {
    const id = Number(slug);
    return products.find((p) => p.id === id) ?? null;
  }

  return null;
}

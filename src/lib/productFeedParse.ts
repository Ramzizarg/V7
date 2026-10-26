/** Turn a product feed (CSV, TSV, XML, or spreadsheet rows) into flat records. */

export const FEED_MAX_BYTES = 25 * 1024 * 1024;
export const FEED_MAX_PRODUCTS = 2000;

const NAME_KEYS = ["name", "title", "product_name", "product", "nom", "titre"];
const DESC_KEYS = ["description", "desc", "body"];
const PRICE_KEYS = ["price", "prix", "regular_price", "regularprice"];
const SALE_KEYS = ["sale_price", "discount_price", "saleprice", "prix_promo", "promo_price"];
const CATEGORY_KEYS = ["category", "category_name", "categorie", "product_type", "google_product_category"];
const COLOR_KEYS = ["color", "colour", "couleur"];
const COLOR2_KEYS = ["color_2", "color2", "couleur_2", "couleur2"];
const IMAGE_KEYS = ["images", "image", "image_link", "image_url", "picture"];
const EXTRA_IMAGE_KEYS = ["additional_image_link", "additional_images", "images_extra"];
const STOCK_KEYS = ["stock", "quantity", "qty", "inventory"];
const SIZE_KEYS = ["size", "taille"];
const GROUP_KEYS = ["item_group_id", "group_id", "parent_sku", "parent_id"];
const ACTIVE_KEYS = ["active", "listed", "status"];
const AVAIL_KEYS = ["availability", "disponibilite"];

const SIZE_COLUMNS: Record<string, string> = {
  standard: "Standard",
  s: "S",
  m: "M",
  l: "L",
  xl: "XL",
  xxl: "XXL",
  "2xl": "XXL",
  "3xl": "3XL",
  xxxl: "3XL",
};

export type FeedProduct = {
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  categoryName: string | null;
  colorName: string | null;
  color2Name: string | null;
  images: string[];
  stock: number;
  sizes: { size: string; stock: number }[] | null;
  active: boolean;
};

export type FeedSkip = { row: number; reason: string };

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

export function headerKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[\s./-]+/g, "_")
    .replace(/_+/g, "_");
}

export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") {
      cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function detectDelimiter(text: string): string {
  const line = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const commas = (line.match(/,/g) ?? []).length;
  const tabs = (line.match(/\t/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  if (tabs > commas && tabs >= semis) return "\t";
  if (semis > commas) return ";";
  return ",";
}

export function rowsFromDelimited(text: string): Record<string, string>[] {
  const table = parseDelimited(text, detectDelimiter(text));
  if (table.length < 2) return [];
  const headers = table[0].map(headerKey);
  return table.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((key, i) => {
      if (!key) return;
      const value = (cells[i] ?? "").trim();
      if (!value) return;
      if (row[key]) row[key] = `${row[key]} | ${value}`;
      else row[key] = value;
    });
    return row;
  });
}

function xmlBlocks(xml: string): string[] {
  const items = xml.match(/<(?:[\w.-]+:)?item\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?item>/gi);
  if (items?.length) return items;
  const entries = xml.match(/<(?:[\w.-]+:)?entry\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?entry>/gi);
  return entries ?? [];
}

function xmlLocalTexts(block: string, localName: string): string[] {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`,
    "gi"
  );
  const out: string[] = [];
  for (const match of block.matchAll(re)) {
    const text = decodeXml(match[1] ?? "").trim();
    if (text) out.push(text);
  }
  return out;
}

export function rowsFromXml(xml: string): Record<string, string>[] {
  return xmlBlocks(xml).map((block) => {
    const row: Record<string, string> = {};
    const take = (key: string, names: string[]) => {
      for (const name of names) {
        const values = xmlLocalTexts(block, name);
        if (values.length) {
          row[key] = values.join(" | ");
          return;
        }
      }
    };
    take("title", ["title"]);
    take("description", ["description", "summary"]);
    take("price", ["price"]);
    take("sale_price", ["sale_price"]);
    take("category", ["product_type", "google_product_category"]);
    take("color", ["color"]);
    take("image_link", ["image_link"]);
    take("additional_image_link", ["additional_image_link"]);
    take("availability", ["availability"]);
    take("size", ["size"]);
    take("quantity", ["quantity"]);
    take("item_group_id", ["item_group_id"]);
    take("id", ["id"]);
    return row;
  });
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

export function parseMoney(raw: string): number | null {
  const match = raw.replace(/\s/g, "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function parseQty(raw: string): number {
  const n = Math.floor(Number(String(raw).replace(",", ".")));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function splitList(raw: string): string[] {
  return raw
    .split(/\s*(?:\||;|\n)\s*|,(?=https?:\/\/)/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function isInactive(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return ["0", "false", "no", "non", "inactive", "draft", "hidden"].includes(t);
}

function isOutOfStock(raw: string): boolean {
  const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return t.includes("out of stock") || t.includes("outofstock") || t === "out_of_stock" || t === "rupture";
}

export function productsFromRows(rows: Record<string, string>[]): {
  products: FeedProduct[];
  skipped: FeedSkip[];
} {
  const skipped: FeedSkip[] = [];
  const groups = new Map<string, FeedProduct>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = pick(row, NAME_KEYS);
    if (!name) {
      skipped.push({ row: rowNumber, reason: "Missing product name" });
      return;
    }

    const groupKey = (pick(row, GROUP_KEYS) || name).toLowerCase();
    let draft = groups.get(groupKey);
    if (!draft) {
      if (groups.size >= FEED_MAX_PRODUCTS) {
        skipped.push({ row: rowNumber, reason: `Stopped after ${FEED_MAX_PRODUCTS} products` });
        return;
      }
      const price = parseMoney(pick(row, PRICE_KEYS)) ?? 0;
      const saleRaw = pick(row, SALE_KEYS);
      const sale = saleRaw ? parseMoney(saleRaw) : null;
      draft = {
        name,
        description: pick(row, DESC_KEYS) || null,
        price,
        discountPrice: sale != null && sale >= 0 && sale < price ? sale : null,
        categoryName: pick(row, CATEGORY_KEYS) || null,
        colorName: pick(row, COLOR_KEYS) || null,
        color2Name: pick(row, COLOR2_KEYS) || null,
        images: [],
        stock: 0,
        sizes: null,
        active: !isInactive(pick(row, ACTIVE_KEYS)),
      };
      groups.set(groupKey, draft);
    }

    for (const key of [...IMAGE_KEYS, ...EXTRA_IMAGE_KEYS]) {
      const raw = row[key];
      if (!raw) continue;
      for (const url of splitList(raw)) {
        if (!draft.images.includes(url)) draft.images.push(url);
      }
    }

    const sizeName = pick(row, SIZE_KEYS);
    const rowQty = parseQty(pick(row, STOCK_KEYS));
    const sized = new Map<string, number>();
    if (draft.sizes) {
      for (const entry of draft.sizes) sized.set(entry.size, entry.stock);
    }
    let sawSize = draft.sizes != null;

    if (sizeName && !sizeName.startsWith("[") && !sizeName.startsWith("{")) {
      sawSize = true;
      const label = SIZE_COLUMNS[sizeName.toLowerCase()] ?? sizeName.trim();
      const qty = isOutOfStock(pick(row, AVAIL_KEYS)) ? 0 : rowQty;
      sized.set(label, (sized.get(label) ?? 0) + qty);
    }

    for (const [header, label] of Object.entries(SIZE_COLUMNS)) {
      if (!(header in row)) continue;
      sawSize = true;
      sized.set(label, (sized.get(label) ?? 0) + parseQty(row[header]));
    }

    if (sawSize) {
      draft.sizes = [...sized.entries()].map(([size, stock]) => ({ size, stock }));
      draft.stock = draft.sizes.reduce((sum, entry) => sum + entry.stock, 0);
    } else if (!draft.sizes) {
      const qty = isOutOfStock(pick(row, AVAIL_KEYS)) ? 0 : rowQty;
      draft.stock = Math.max(draft.stock, qty);
    }
  });

  return { products: [...groups.values()], skipped };
}

export function parseFeedText(text: string, filename = ""): {
  products: FeedProduct[];
  skipped: FeedSkip[];
} {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { products: [], skipped: [] };
  const lowerName = filename.toLowerCase();
  const looksXml =
    lowerName.endsWith(".xml") ||
    trimmed.startsWith("<") ||
    trimmed.startsWith("<?xml");
  const rows = looksXml ? rowsFromXml(trimmed) : rowsFromDelimited(trimmed);
  return productsFromRows(rows);
}

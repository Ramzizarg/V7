import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/get-product";
import { brandIcons } from "@/lib/siteIconsMeta";
import ProductDetailView from "./ProductDetailView";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return { title: "Produit | Vero7", icons: brandIcons };
  }
  return {
    title: `${product.name} | Vero7`,
    description: product.description?.slice(0, 160) || `Achetez ${product.name} sur Vero7.`,
    icons: brandIcons,
  };
}

export default async function CollectionProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  return <ProductDetailView product={product} />;
}

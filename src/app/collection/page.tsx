import type { Metadata } from "next";
import { brandIcons } from "@/lib/siteIconsMeta";
import CollectionView from "./CollectionView";

export const metadata: Metadata = {
  title: "Boutique | Vero7",
  description: "Parcourez la collection Vero7 : essentiels sport et casual.",
  icons: brandIcons,
};

export default function CollectionPage() {
  return <CollectionView />;
}

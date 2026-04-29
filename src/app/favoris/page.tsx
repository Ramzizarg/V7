import type { Metadata } from "next";
import { brandIcons } from "@/lib/siteIconsMeta";
import FavorisClient from "./FavorisClient";

export const metadata: Metadata = {
  title: "Favoris | Vero7",
  description: "Vos articles favoris Vero7.",
  icons: brandIcons,
};

export default function FavorisPage() {
  return <FavorisClient />;
}

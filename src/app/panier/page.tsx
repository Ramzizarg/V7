import type { Metadata } from "next";
import { brandIcons } from "@/lib/siteIconsMeta";
import PanierClient from "./PanierClient";

export const metadata: Metadata = {
  title: "Panier | Vero7",
  description: "Votre panier Vero7.",
  icons: brandIcons,
};

export default function PanierPage() {
  return <PanierClient />;
}

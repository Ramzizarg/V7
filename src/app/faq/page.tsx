import type { Metadata } from "next";
import { brandIcons } from "@/lib/siteIconsMeta";
import FaqContent from "./FaqContent";

export const metadata: Metadata = {
  title: "FAQ | Vero7",
  description:
    "Questions fréquentes sur les commandes, la livraison, les retours et le paiement chez Vero7.",
  icons: brandIcons,
};

export default function FaqPage() {
  return <FaqContent />;
}

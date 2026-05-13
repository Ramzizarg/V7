import type { Metadata } from "next";
import { brandIcons } from "@/lib/siteIconsMeta";
import AProposContent from "./AProposContent";

export const metadata: Metadata = {
  title: "A Propos | Vero7",
  description:
    "Découvrez l'histoire de Vero7, notre mission et nos valeurs. Marque streetwear et sportswear tunisienne.",
  icons: brandIcons,
};

export default function AProposPage() {
  return <AProposContent />;
}

import type { Metadata } from "next";
import { brandIcons } from "@/lib/siteIconsMeta";
import SizeGuideContent from "./SizeGuideContent";

export const metadata: Metadata = {
  title: "Guide des tailles | Vero7",
  description:
    "Consultez le guide des tailles Vero7 pour homme et femme. Mesures en cm ou pouces et conseils pour bien prendre vos mensurations.",
  icons: brandIcons,
};

export default function SizeGuidePage() {
  return <SizeGuideContent />;
}

import type { Metadata } from "next";
import { brandIcons } from "@/lib/siteIconsMeta";
import ShippingTermsContent from "./ShippingTermsContent";

export const metadata: Metadata = {
  title: "Livraison & Conditions | Vero7",
  description:
    "Consultez nos conditions de livraison, délais, frais d'expédition et politique de retours.",
  icons: brandIcons,
};

export default function ShippingTermsPage() {
  return <ShippingTermsContent />;
}

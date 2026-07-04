import type { Metadata } from "next";
import { brandIcons } from "@/lib/siteIconsMeta";
import ContactContent from "./ContactContent";

export const metadata: Metadata = {
  title: "Contact | Vero7",
  description:
    "Contactez l'équipe Vero7 par Instagram, e-mail ou téléphone. Nous sommes à votre écoute du lundi au vendredi.",
  icons: brandIcons,
};

export default function ContactPage() {
  return <ContactContent />;
}

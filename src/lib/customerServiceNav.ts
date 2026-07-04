export type CustomerServiceNavItem = {
  href: string;
  label: string;
};

export const CUSTOMER_SERVICE_NAV: CustomerServiceNavItem[] = [
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/shipping-terms", label: "Livraison & Retours" },
  { href: "/guide-des-tailles", label: "Guide des tailles" },
];

export function getCustomerServiceLabel(pathname: string): string {
  const match = CUSTOMER_SERVICE_NAV.find((item) => item.href === pathname);
  return match?.label ?? "Service client";
}

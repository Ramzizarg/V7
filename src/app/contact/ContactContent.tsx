"use client";

import CustomerServiceLayout from "@/components/CustomerServiceLayout";
import { useTranslations } from "@/i18n/SiteLocaleProvider";

const INSTAGRAM_URL = "https://www.instagram.com/vero7.tn/";
const CONTACT_EMAIL = "contact@vero-7.com";
const CONTACT_PHONE = "+216 25 191 292";
const CONTACT_PHONE_HREF = "tel:+21625191292";

function ContactSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 p-6 sm:p-8">
      <h3 className="mb-4 text-lg font-bold uppercase tracking-wide">{title}</h3>
      <div className="text-sm leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}

export default function ContactContent() {
  const { t } = useTranslations();

  return (
    <CustomerServiceLayout title={t("contact.title")} subtitle={t("contact.subtitle")}>
      <div className="space-y-6">
        <ContactSection title={t("contact.socialTitle")}>
          <p>
            {t("contact.socialDesc")}{" "}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
            >
              @vero7.tn
            </a>
            . {t("contact.socialResponse")}
          </p>
          <p className="mt-3 text-neutral-500">{t("contact.businessHours")}</p>
        </ContactSection>

        <ContactSection title={t("contact.emailTitle")}>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
          >
            {CONTACT_EMAIL}
          </a>
          <p className="mt-3">{t("contact.emailResponse")}</p>
        </ContactSection>

        <ContactSection title={t("contact.phoneTitle")}>
          <a
            href={CONTACT_PHONE_HREF}
            className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
          >
            {CONTACT_PHONE}
          </a>
          <span className="text-neutral-500"> {t("contact.phoneRegion")}</span>
          <p className="mt-3 text-neutral-500">{t("contact.phoneHours")}</p>
        </ContactSection>
      </div>
    </CustomerServiceLayout>
  );
}

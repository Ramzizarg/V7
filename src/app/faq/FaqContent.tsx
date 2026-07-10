"use client";

import { useState } from "react";
import CustomerServiceLayout from "@/components/CustomerServiceLayout";
import { useTranslations } from "@/i18n/SiteLocaleProvider";

interface FaqItem {
  question: string;
  answer: string;
}

function FaqAccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-neutral-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="pr-4 text-sm font-semibold text-neutral-900">
          {item.question}
        </span>
        <span className="flex-shrink-0 text-lg text-neutral-400">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <p className="pb-5 pr-8 text-sm leading-relaxed text-neutral-600">
          {item.answer}
        </p>
      )}
    </div>
  );
}

export default function FaqContent() {
  const { t, messages } = useTranslations();
  const faqItems = messages.faq.items;

  return (
    <CustomerServiceLayout title={t("faq.title")} subtitle={t("faq.subtitle")}>
      <div className="divide-y divide-neutral-200 border-t border-neutral-200">
        {faqItems.map((item, i) => (
          <FaqAccordionItem key={i} item={{ question: item.q, answer: item.a }} />
        ))}
      </div>

      <div className="mt-12 rounded-lg bg-neutral-50 p-6 text-center">
        <p className="text-sm text-neutral-700">{t("faq.notFound")}</p>
        <p className="mt-1 text-sm text-neutral-700">
          {t("faq.contactUs")}{" "}
          <a
            href="mailto:contact@vero-7.com"
            className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
          >
            contact@vero-7.com
          </a>
        </p>
      </div>
    </CustomerServiceLayout>
  );
}

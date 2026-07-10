"use client";

import { useEffect } from "react";
import { applySiteLocale, getSiteLocale } from "@/lib/siteLocale";

export function SiteLocaleInit() {
  useEffect(() => {
    applySiteLocale(getSiteLocale());
  }, []);

  return null;
}

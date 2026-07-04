"use client";

import { useState } from "react";
import { trackMetaLead } from "@/lib/metaPixel";

const INSTAGRAM_URL = "https://www.instagram.com/vero7.tn/";
const FACEBOOK_URL =
  "https://www.facebook.com/share/1JVw34RVAj/?mibextid=wwXIfr";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

const socialLinkClass =
  "inline-flex items-center gap-2.5 text-sm font-bold text-white transition hover:text-white/90 sm:text-base";

export default function SiteFooter() {
  const [nlEmail, setNlEmail] = useState("");
  const [nlStatus, setNlStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nlEmail.trim();
    if (!trimmed) return;
    setNlStatus("loading");
    try {
      const metaEventId = trackMetaLead({ email: trimmed, country: "tn" });
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, metaEventId }),
      });
      if (!res.ok) throw new Error();
      setNlStatus("success");
      setNlEmail("");
    } catch {
      setNlStatus("error");
    }
  };

  return (
    <footer className="bg-[#0f1f63] text-white">
      <div className="mx-auto w-full max-w-[1400px] px-6 py-10 sm:px-8 lg:px-12">
        <div className="grid gap-10 border-b border-white/20 pb-10 lg:grid-cols-[1fr_1fr_2fr]">
          <div>
            <h3 className="mb-4 text-sm font-extrabold uppercase tracking-[0.04em]">A Propos De Vero7</h3>
            <ul className="space-y-2 text-sm text-white/90">
              <li><a href="/a-propos" className="transition hover:text-white">A propos de nous</a></li>
              <li><a href="/collection" className="transition hover:text-white">Nos collections</a></li>
              <li><a href="#" className="transition hover:text-white">Athletes</a></li>
              <li><a href="/#club" className="transition hover:text-white">Club Vero7</a></li>
            </ul>
            <div className="mt-6 hidden flex-wrap items-center gap-6 lg:flex">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={socialLinkClass}
                aria-label="Suivez Vero7 sur Instagram"
              >
                <InstagramIcon className="h-5 w-5 shrink-0" />
                Instagram
              </a>
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={socialLinkClass}
                aria-label="Suivez Vero7 sur Facebook"
              >
                <FacebookIcon className="h-5 w-5 shrink-0" />
                Facebook
              </a>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-extrabold uppercase tracking-[0.04em]">Service Client</h3>
            <ul className="space-y-2 text-sm text-white/90">
              <li><a href="/faq" className="transition hover:text-white">FAQ</a></li>
              <li><a href="/shipping-terms" className="transition hover:text-white">Livraison & Retours</a></li>
              <li><a href="/guide-des-tailles" className="transition hover:text-white">Guide des tailles</a></li>
              <li><a href="/contact" className="transition hover:text-white">Contact</a></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-3xl font-black uppercase leading-none">Abonnez-vous et obtenez -10%</h3>
            <p className="mb-4 max-w-xl text-sm text-white/80">
              Recevez les dernieres nouveautes, nos offres exclusives et les infos sur les nouveaux drops Vero7.
            </p>
            <form className="max-w-md" onSubmit={handleNewsletterSubmit}>
              <input
                type="email"
                placeholder="example@mail.com"
                value={nlEmail}
                onChange={(e) => {
                  setNlEmail(e.target.value);
                  if (nlStatus !== "idle" && nlStatus !== "loading") setNlStatus("idle");
                }}
                className="mb-4 w-full border border-white/35 bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
              <button
                type="submit"
                disabled={nlStatus === "loading"}
                className="bg-white px-8 py-2.5 text-sm font-semibold text-[#0f1f63] transition hover:bg-white/90 disabled:opacity-60"
              >
                {nlStatus === "loading" ? "..." : "S\u0027abonner"}
              </button>
              {nlStatus === "success" ? (
                <p className="mt-2 text-sm text-green-300">Merci ! Verifiez votre boite mail.</p>
              ) : null}
              {nlStatus === "error" ? (
                <p className="mt-2 text-sm text-red-300">Erreur, veuillez reessayer.</p>
              ) : null}
            </form>
          </div>
        </div>

        {/* Mobile : réseaux sociaux au-dessus du copyright */}
        <div className="flex flex-col gap-3 border-t border-white/20 pt-6 lg:border-t-0 lg:pt-4">
          <div className="flex flex-wrap items-center gap-6 lg:hidden">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={socialLinkClass}
              aria-label="Suivez Vero7 sur Instagram"
            >
              <InstagramIcon className="h-5 w-5 shrink-0" />
              Instagram
            </a>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={socialLinkClass}
              aria-label="Suivez Vero7 sur Facebook"
            >
              <FacebookIcon className="h-5 w-5 shrink-0" />
              Facebook
            </a>
          </div>
          <p className="text-xs text-white/55">
            Copyright © {new Date().getFullYear()} Vero7 - Tous droits reserves
          </p>
        </div>
      </div>
    </footer>
  );
}

"use client";

import { useState } from "react";

export default function SiteFooter() {
  const [nlEmail, setNlEmail] = useState("");
  const [nlStatus, setNlStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nlEmail.trim();
    if (!trimmed) return;
    setNlStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
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
              <li><a href="#" className="transition hover:text-white">Club Vero7</a></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-extrabold uppercase tracking-[0.04em]">Service Client</h3>
            <ul className="space-y-2 text-sm text-white/90">
              <li><a href="/faq" className="transition hover:text-white">FAQ</a></li>
              <li><a href="/shipping-terms" className="transition hover:text-white">Livraison & Retours</a></li>
              <li><a href="#" className="transition hover:text-white">Guide des tailles</a></li>
              <li><a href="#" className="transition hover:text-white">Contact</a></li>
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

        <div className="pt-6 text-xs text-white/55">
          Copyright © {new Date().getFullYear()} Vero7 - Tous droits reserves
        </div>
      </div>
    </footer>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import { ClubBenefitsList } from "@/components/ClubBenefitsList";
import { brandIcons } from "@/lib/siteIconsMeta";
import { LoginFormPanel } from "./LoginFormPanel";

export const metadata: Metadata = {
  title: "Connexion | Vero7 Backoffice",
  icons: brandIcons,
};

type LoginPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const hasError = params.error === "1";

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="/" className="flex items-center" aria-label="Accueil Vero7">
            <Image
              src="/vero7-logo.png"
              alt="Vero7 logo"
              width={72}
              height={72}
              className="h-14 w-auto object-contain"
              priority
              loading="eager"
            />
          </a>
          <a
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.08em] text-black/70 transition hover:text-black"
          >
            Retour au site
          </a>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center px-5 py-10 sm:px-8">
        <div className="w-full border border-black/10 bg-white p-6 sm:p-10">
          <div className="grid gap-10 lg:grid-cols-2">
            <LoginFormPanel hasError={hasError} />

            <section>
              <h2 className="text-3xl font-black uppercase leading-tight">
                Envie de rejoindre le club Vero7 ?
              </h2>
              <a
                href="/#club"
                className="mt-4 inline-flex border border-black px-5 py-2 text-xs font-bold uppercase tracking-[0.08em] transition hover:bg-black hover:text-white"
              >
                Inscription
              </a>

              <h3 className="mt-10 text-2xl font-black uppercase">Avantages exclusifs</h3>
              <ClubBenefitsList
                className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"
                itemClassName="flex items-center gap-2.5 text-sm font-semibold uppercase"
                iconWrapClassName="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/25 bg-zinc-50 text-black"
              />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

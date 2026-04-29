"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type LoginFormPanelProps = {
  hasError: boolean;
};

export function LoginFormPanel({ hasError }: LoginFormPanelProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section>
      <h1 className="text-3xl font-black uppercase tracking-[0.03em]">Login</h1>

      {hasError ? (
        <p className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Email ou mot de passe invalide.
        </p>
      ) : null}

      <form action="/api/backoffice/login" method="POST" className="mt-8 space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm text-zinc-500">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full border-b border-zinc-300 px-0 py-2 text-sm outline-none transition focus:border-black"
          />
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="block text-sm text-zinc-500">
              Password
            </label>
            <a href="/" className="text-xs text-zinc-500 underline hover:text-black">
              Retour site
            </a>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="mt-1 w-full border-b border-zinc-300 px-0 py-2 pr-9 text-sm outline-none transition focus:border-black"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-zinc-500 transition hover:text-black"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <button
          type="submit"
          className="bg-[#1a2b72] px-8 py-2 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#132058]"
        >
          Login
        </button>
      </form>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  HomeContent,
  HomeProduct,
  defaultHomeContent,
  getHomeContent,
  saveHomeContent,
  syncHeroImagePositionsDesktop,
  syncHeroImagePositionsMobile,
} from "@/lib/homeContent";
import {
  defaultComingSoonSettings,
  type ComingSoonSettings,
  uploadComingSoonImage,
} from "@/lib/comingSoon";
import {
  Save,
  Type,
  ShoppingBag,
  LayoutGrid,
  Mail,
  Check,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  ImageIcon,
  ChevronUp,
  ChevronDown,
  PanelTop,
  Clock,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { uploadHeroImage, uploadHomeImage } from "@/lib/uploadHeroImage";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import type { Product } from "@/lib/types";

export default function DashboardHomePage() {
  const [content, setContent] = useState<HomeContent>(defaultHomeContent);
  const [shopProducts, setShopProducts] = useState<Product[]>([]);
  const [comingSoon, setComingSoon] = useState<ComingSoonSettings>(defaultComingSoonSettings);
  const [comingSoonSaved, setComingSoonSaved] = useState(false);
  const [comingSoonSaving, setComingSoonSaving] = useState(false);
  const [comingSoonError, setComingSoonError] = useState<string | null>(null);
  const [comingSoonUploading, setComingSoonUploading] = useState(false);
  const [comingSoonUploadError, setComingSoonUploadError] = useState<string | null>(null);
  const [comingSoonHasPassword, setComingSoonHasPassword] = useState(false);
  const [showNewComingSoonPassword, setShowNewComingSoonPassword] = useState(false);
  const [lastSavedComingSoonPassword, setLastSavedComingSoonPassword] = useState("");
  const [showLastSavedComingSoonPassword, setShowLastSavedComingSoonPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroUploadError, setHeroUploadError] = useState<string | null>(null);
  const [selectedHeroPreviewIndex, setSelectedHeroPreviewIndex] = useState(0);
  const [cat1Uploading, setCat1Uploading] = useState(false);
  const [cat1UploadError, setCat1UploadError] = useState<string | null>(null);
  const [cat2Uploading, setCat2Uploading] = useState(false);
  const [cat2UploadError, setCat2UploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"hero" | "bandeau" | "products" | "categories" | "footer" | "comingSoon">("hero");

  const selectedHeroPreviewUrl =
    content.heroImageUrls[selectedHeroPreviewIndex] ?? content.heroImageUrls[0] ?? "";
  const selectedHeroPositionMobile =
    content.heroImagePositionsMobile[selectedHeroPreviewIndex] ??
    (typeof content.heroImagePositionMobile === "number" ? content.heroImagePositionMobile : 50);
  const selectedHeroPositionDesktop =
    content.heroImagePositionsDesktop?.[selectedHeroPreviewIndex] ?? 30;

  useEffect(() => {
    getHomeContent()
      .then(setContent)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/coming-soon/settings", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return null;
        return (await r.json().catch(() => null)) as any;
      })
      .then((s) => {
        if (!s || typeof s !== "object") return;
        setComingSoon({
          enabled: Boolean(s.enabled),
          heroImageUrl: String(s.heroImageUrl ?? ""),
          endAt: String(s.endAt ?? ""),
          requirePassword: Boolean(s.requirePassword),
          newPassword: "",
        });
        setComingSoonHasPassword(Boolean(s.hasPassword));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem("bt_cs_last_password") || "";
      if (v) setLastSavedComingSoonPassword(v);
    } catch {}
  }, []);

  useEffect(() => {
    supabaseBrowserClient()
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setShopProducts((data ?? []) as Product[]));
  }, []);

  const handleSave = async () => {
    await saveHomeContent(content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveComingSoon = async () => {
    setComingSoonError(null);
    setComingSoonSaving(true);
    const candidateNewPassword = (comingSoon.newPassword || "").trim();
    try {
      const res = await fetch("/api/coming-soon/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: comingSoon.enabled,
          heroImageUrl: comingSoon.heroImageUrl,
          endAt: comingSoon.endAt,
          requirePassword: comingSoon.requirePassword,
          newPassword: candidateNewPassword,
        }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || "Save failed");
      setComingSoon((p) => ({ ...p, newPassword: "" }));
      setComingSoonHasPassword(true);
      if (candidateNewPassword) {
        setLastSavedComingSoonPassword(candidateNewPassword);
        try {
          localStorage.setItem("bt_cs_last_password", candidateNewPassword);
        } catch {}
      }
      setComingSoonSaved(true);
      setTimeout(() => setComingSoonSaved(false), 2000);
    } catch (e) {
      setComingSoonError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setComingSoonSaving(false);
    }
  };

  const validateComingSoonImage = async (file: File) => {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const w = img.naturalWidth || 0;
      const h = img.naturalHeight || 0;
      if (w < 1376 || h < 768) {
        throw new Error("Image too small. Minimum 1376×768 (or 1920×1080).");
      }
      const ratio = w / h;
      const target = 16 / 9;
      if (Math.abs(ratio - target) > 0.03) {
        throw new Error("Wrong ratio. Please use 16:9 (1920×1080 or 1376×768).");
      }
      return true;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const setEndIn = (minutes: number) => {
    const ms = Date.now() + minutes * 60_000;
    setComingSoon((p) => ({ ...p, endAt: new Date(ms).toISOString() }));
  };

  const setEndFromParts = (datePart: string, timePart: string) => {
    if (!datePart || !timePart) return;
    const iso = new Date(`${datePart}T${timePart}:00`).toISOString();
    setComingSoon((p) => ({ ...p, endAt: iso }));
  };

  const updateField = (
    field: keyof HomeContent,
    value: string | number | boolean | string[] | number[]
  ) => {
    setContent((prev) => ({ ...prev, [field]: value }));
  };

  const updateSelectedHeroPositionMobile = (value: number) => {
    setContent((prev) => {
      const urls = prev.heroImageUrls;
      if (urls.length === 0) return prev;
      const index = Math.min(selectedHeroPreviewIndex, urls.length - 1);
      const positions = syncHeroImagePositionsMobile(
        urls,
        prev.heroImagePositionsMobile,
        prev.heroImagePositionMobile
      );
      positions[index] = Math.min(100, Math.max(0, Math.round(value)));
      return {
        ...prev,
        heroImagePositionsMobile: positions,
        heroImagePositionMobile: positions[0] ?? 50,
      };
    });
  };

  const updateSelectedHeroPositionDesktop = (value: number) => {
    setContent((prev) => {
      const urls = prev.heroImageUrls;
      if (urls.length === 0) return prev;
      const index = Math.min(selectedHeroPreviewIndex, urls.length - 1);
      const positions = syncHeroImagePositionsDesktop(urls, prev.heroImagePositionsDesktop, 30);
      positions[index] = Math.min(100, Math.max(0, Math.round(value)));
      return {
        ...prev,
        heroImagePositionsDesktop: positions,
      };
    });
  };

  const updateBannerPhrase = (index: number, value: string) => {
    setContent((prev) => {
      const phrases = [...(prev.bannerPhrases || [])];
      phrases[index] = value;
      return { ...prev, bannerPhrases: phrases };
    });
  };
  const addBannerPhrase = () => {
    setContent((prev) => ({
      ...prev,
      bannerPhrases: [...(prev.bannerPhrases || []), ""],
    }));
  };
  const removeBannerPhrase = (index: number) => {
    setContent((prev) => {
      const phrases = (prev.bannerPhrases || []).filter((_, i) => i !== index);
      return { ...prev, bannerPhrases: phrases.length ? phrases : ["New phrase"] };
    });
  };

  const updateProduct = (index: number, field: keyof HomeProduct, value: string) => {
    setContent((prev) => {
      const products = [...prev.products];
      products[index] = { ...products[index], [field]: value };
      return { ...prev, products };
    });
  };

  const addProduct = () => {
    setContent((prev) => ({
      ...prev,
      products: [...prev.products, { product_id: null, name: "", price: "" }],
    }));
  };

  const moveProduct = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= content.products.length) return;
    setContent((prev) => {
      const products = [...prev.products];
      [products[index], products[newIndex]] = [products[newIndex], products[index]];
      return { ...prev, products };
    });
  };

  const selectProduct = (index: number, productId: string) => {
    if (!productId) {
      setContent((prev) => {
        const products = [...prev.products];
        products[index] = { product_id: null, name: "", price: "" };
        return { ...prev, products };
      });
      return;
    }
    const id = parseInt(productId, 10);
    const p = shopProducts.find((x) => x.id === id);
    if (!p) return;
    const priceStr =
      p.discount_price != null
        ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND", minimumFractionDigits: 2 }).format(p.discount_price)
        : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND", minimumFractionDigits: 2 }).format(p.price);
    setContent((prev) => {
      const products = [...prev.products];
      products[index] = { product_id: p.id, name: p.name, price: priceStr };
      return { ...prev, products };
    });
  };

  const removeProduct = (index: number) => {
    setContent((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
    }));
  };

  const tabs = [
    { id: "hero" as const, label: "Hero", icon: Type },
    { id: "bandeau" as const, label: "Bandeau", icon: PanelTop },
    { id: "products" as const, label: "Products", icon: ShoppingBag },
    { id: "categories" as const, label: "Catégories", icon: LayoutGrid },
    { id: "footer" as const, label: "Newsletter", icon: Mail },
    { id: "comingSoon" as const, label: "Coming soon", icon: Clock },
  ];

  if (loading) {
    return (
      <div
        className="max-w-5xl mx-auto flex items-center justify-center py-20"
        style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      >
        <p className="text-sm text-zinc-500 uppercase tracking-wider">Loading…</p>
      </div>
    );
  }

  return (
    <div
      className="max-w-5xl mx-auto w-full min-w-0"
      style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      {/* Page Header */}
      <div className="flex flex-col gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-black">
            Edit home page
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Edit the content visible on the site home page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 sm:px-4 text-xs font-medium uppercase tracking-wider border border-zinc-300 text-zinc-600 hover:text-black hover:border-black transition-colors rounded min-w-[2.75rem] sm:min-w-0"
            title="View site"
          >
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">View site</span>
          </Link>
          <button
            onClick={handleSave}
            className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all duration-200 ${
              saved
                ? "bg-emerald-600 text-white"
                : "bg-black text-white hover:bg-zinc-800"
            }`}
          >
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-zinc-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 px-3 py-2.5 sm:px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-black text-black"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Hero Section Editor */}
      {activeTab === "hero" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-700 bg-black p-4 sm:p-6 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Type className="h-4 w-4" />
              Section Hero
            </h2>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                Images Hero (carousel)
              </label>
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black border border-white rounded text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-zinc-100 hover:border-zinc-100 transition-colors">
                  <Upload className="h-4 w-4" />
                  {heroUploading ? "Upload…" : "Ajouter image(s)"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={heroUploading}
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files?.length) return;
                      setHeroUploadError(null);
                      setHeroUploading(true);
                      try {
                        const uploaded: string[] = [];
                        for (let i = 0; i < files.length; i++) {
                          const url = await uploadHeroImage(files[i]);
                          uploaded.push(url);
                        }
                        setContent((prev) => {
                          const next = [...prev.heroImageUrls, ...uploaded];
                          const positions = syncHeroImagePositionsMobile(
                            prev.heroImageUrls,
                            prev.heroImagePositionsMobile,
                            prev.heroImagePositionMobile
                          );
                          const nextPositions = [
                            ...positions,
                            ...uploaded.map(() => 50),
                          ];
                          const desktopPositions = syncHeroImagePositionsDesktop(
                            prev.heroImageUrls,
                            prev.heroImagePositionsDesktop,
                            30
                          );
                          const nextDesktopPositions = [
                            ...desktopPositions,
                            ...uploaded.map(() => 30),
                          ];
                          return {
                            ...prev,
                            heroImageUrls: next,
                            heroImageUrl: next[0] ?? "",
                            heroImagePositionsMobile: nextPositions,
                            heroImagePositionMobile: nextPositions[0] ?? 50,
                            heroImagePositionsDesktop: nextDesktopPositions,
                          };
                        });
                      } catch (err) {
                        setHeroUploadError(err instanceof Error ? err.message : "Erreur d’upload");
                      } finally {
                        setHeroUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                {content.heroImageUrls.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setContent((prev) => ({
                        ...prev,
                        heroImageUrls: [],
                        heroImageUrl: "",
                        heroImagePositionsMobile: [],
                        heroImagePositionMobile: 50,
                        heroImagePositionsDesktop: [],
                      }))
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-600 rounded text-zinc-300 text-xs font-semibold uppercase tracking-wider hover:bg-zinc-800 hover:text-white transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Vider la liste
                  </button>
                )}
              </div>
              {heroUploadError && (
                <p className="text-xs text-red-400">{heroUploadError}</p>
              )}
              <p className="text-[10px] text-zinc-400">Best quality: high‑resolution images (min 1920×1080). JPEG, PNG or WebP.</p>
              {content.heroImageUrls.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-400">
                    Ordre du carousel ({content.heroImageUrls.length} image{content.heroImageUrls.length > 1 ? "s" : ""})
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {content.heroImageUrls.map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        className={`flex items-center gap-2 rounded border p-2 transition-colors ${
                          index === selectedHeroPreviewIndex
                            ? "border-white bg-zinc-800"
                            : "border-zinc-700 bg-zinc-900"
                        }`}
                        onClick={() => setSelectedHeroPreviewIndex(index)}
                      >
                        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded border border-zinc-700 bg-black">
                          <img
                            src={url}
                            alt={`Hero ${index + 1}`}
                            className="h-full w-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-zinc-300">{url}</p>
                          <p className="text-[10px] text-zinc-500">
                            {index === 0 ? "Image principale (affichée en premier)" : `Position ${index + 1}`}
                            {" · "}
                            mobile {(content.heroImagePositionsMobile[index] ?? 50)}%
                            {" · "}
                            desktop {(content.heroImagePositionsDesktop?.[index] ?? 30)}%
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {index > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setContent((prev) => {
                                  const next = [...prev.heroImageUrls];
                                  const positions = syncHeroImagePositionsMobile(
                                    prev.heroImageUrls,
                                    prev.heroImagePositionsMobile,
                                    prev.heroImagePositionMobile
                                  );
                                  const desktopPositions = syncHeroImagePositionsDesktop(
                                    prev.heroImageUrls,
                                    prev.heroImagePositionsDesktop,
                                    30
                                  );
                                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                  [positions[index - 1], positions[index]] = [
                                    positions[index],
                                    positions[index - 1],
                                  ];
                                  [desktopPositions[index - 1], desktopPositions[index]] = [
                                    desktopPositions[index],
                                    desktopPositions[index - 1],
                                  ];
                                  setSelectedHeroPreviewIndex((curr) => {
                                    if (curr === index) return index - 1;
                                    if (curr === index - 1) return index;
                                    return curr;
                                  });
                                  return {
                                    ...prev,
                                    heroImageUrls: next,
                                    heroImageUrl: next[0] ?? "",
                                    heroImagePositionsMobile: positions,
                                    heroImagePositionMobile: positions[0] ?? 50,
                                    heroImagePositionsDesktop: desktopPositions,
                                  };
                                })
                              }
                              className="rounded border border-zinc-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 hover:bg-zinc-800"
                            >
                              ↑
                            </button>
                          ) : null}
                          {index < content.heroImageUrls.length - 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setContent((prev) => {
                                  const next = [...prev.heroImageUrls];
                                  const positions = syncHeroImagePositionsMobile(
                                    prev.heroImageUrls,
                                    prev.heroImagePositionsMobile,
                                    prev.heroImagePositionMobile
                                  );
                                  const desktopPositions = syncHeroImagePositionsDesktop(
                                    prev.heroImageUrls,
                                    prev.heroImagePositionsDesktop,
                                    30
                                  );
                                  [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                  [positions[index], positions[index + 1]] = [
                                    positions[index + 1],
                                    positions[index],
                                  ];
                                  [desktopPositions[index], desktopPositions[index + 1]] = [
                                    desktopPositions[index + 1],
                                    desktopPositions[index],
                                  ];
                                  setSelectedHeroPreviewIndex((curr) => {
                                    if (curr === index) return index + 1;
                                    if (curr === index + 1) return index;
                                    return curr;
                                  });
                                  return {
                                    ...prev,
                                    heroImageUrls: next,
                                    heroImageUrl: next[0] ?? "",
                                    heroImagePositionsMobile: positions,
                                    heroImagePositionMobile: positions[0] ?? 50,
                                    heroImagePositionsDesktop: desktopPositions,
                                  };
                                })
                              }
                              className="rounded border border-zinc-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 hover:bg-zinc-800"
                            >
                              ↓
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setContent((prev) => {
                                const next = prev.heroImageUrls.filter((_, i) => i !== index);
                                const positions = syncHeroImagePositionsMobile(
                                  prev.heroImageUrls,
                                  prev.heroImagePositionsMobile,
                                  prev.heroImagePositionMobile
                                ).filter((_, i) => i !== index);
                                const desktopPositions = syncHeroImagePositionsDesktop(
                                  prev.heroImageUrls,
                                  prev.heroImagePositionsDesktop,
                                  30
                                ).filter((_, i) => i !== index);
                                setSelectedHeroPreviewIndex((curr) => {
                                  if (next.length === 0) return 0;
                                  if (curr === index) return Math.max(0, index - 1);
                                  if (curr > index) return curr - 1;
                                  return curr;
                                });
                                return {
                                  ...prev,
                                  heroImageUrls: next,
                                  heroImageUrl: next[0] ?? "",
                                  heroImagePositionsMobile: positions,
                                  heroImagePositionMobile: positions[0] ?? 50,
                                  heroImagePositionsDesktop: desktopPositions,
                                };
                              })
                            }
                            className="rounded border border-red-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-300 hover:bg-red-950/40"
                          >
                            Suppr.
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedHeroPreviewUrl && (
                <div className="mt-3 flex justify-center">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-3 items-end w-full max-w-4xl mx-auto">
                  <div className="w-full">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1.5">Version desktop</p>
                    <p className="text-[10px] text-zinc-500 mb-1.5">
                      Position verticale (haut ↔ bas) — image {selectedHeroPreviewIndex + 1}
                    </p>
                    <div className="flex items-center gap-2 mb-2 w-full max-w-md">
                      <span className="text-[10px] text-zinc-500 shrink-0">Haut</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={selectedHeroPositionDesktop}
                        onChange={(e) => updateSelectedHeroPositionDesktop(parseInt(e.target.value, 10))}
                        className="flex-1 h-2 rounded-full appearance-none bg-zinc-700 accent-white"
                      />
                      <span className="text-[10px] text-zinc-500 shrink-0">Bas</span>
                    </div>
                    <p className="text-[9px] text-zinc-500 mb-2">{selectedHeroPositionDesktop}%</p>
                    <div className="relative aspect-video w-full rounded overflow-hidden border border-zinc-600 bg-black">
                      <img
                        src={selectedHeroPreviewUrl}
                        alt="Hero preview"
                        style={{ objectPosition: `center ${selectedHeroPositionDesktop}%` }}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-start justify-end lg:pt-0">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1.5">Version mobile</p>
                    <p className="text-[10px] text-zinc-500 mb-1.5">
                      Position de l’image sélectionnée (gauche ↔ droite) — image {selectedHeroPreviewIndex + 1}
                    </p>
                    <div className="flex items-center gap-2 mb-2 w-full max-w-[200px]">
                      <span className="text-[10px] text-zinc-500 shrink-0">0%</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={selectedHeroPositionMobile}
                        onChange={(e) => updateSelectedHeroPositionMobile(parseInt(e.target.value, 10))}
                        className="flex-1 h-2 rounded-full appearance-none bg-zinc-700 accent-white"
                      />
                      <span className="text-[10px] text-zinc-500 shrink-0">100%</span>
                    </div>
                    <p className="text-[9px] text-zinc-500 mb-2">{selectedHeroPositionMobile}%</p>
                    <div className="relative w-[140px] sm:w-[160px] aspect-[9/16] max-h-[300px] rounded-xl overflow-hidden border-2 border-zinc-600 bg-black shadow-xl">
                      <img
                        src={selectedHeroPreviewUrl}
                        alt="Hero mobile"
                        style={{ objectPosition: `${selectedHeroPositionMobile}% center` }}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
                        <span className="text-white/50 text-[8px] font-black font-mono tracking-widest">001</span>
                        <span className="text-white/50 text-[6px] font-black font-mono tracking-[0.1em] uppercase">@TAWAKUL</span>
                      </div>
                      <div className="absolute inset-x-0 bottom-2 px-1.5">
                        {content.heroShowOverlay && content.heroHeadline.trim() ? (
                          <h2 className="text-[10px] font-black uppercase tracking-tight leading-tight whitespace-pre-line drop-shadow-lg" style={{ color: content.heroHeadlineColor || "#ffffff" }}>
                            {content.heroHeadline}
                          </h2>
                        ) : null}
                        {content.heroShowOverlay && content.heroDescription.trim() ? (
                          <p className="text-[6px] font-light tracking-wide mt-0.5 line-clamp-2" style={{ color: content.heroDescriptionColor || "#ffffff" }}>
                            {content.heroDescription}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              )}
              {content.heroImageUrls.length === 0 && (
                <div className="mt-2 flex items-center gap-2 text-zinc-500 text-xs">
                  <ImageIcon className="h-4 w-4 flex-shrink-0" />
                  <span>Aucune image. L’image par défaut du site sera affichée.</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-zinc-600 bg-zinc-900/80 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white">
                    Textes & boutons du hero
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Désactivé = images seules. Activé = affiche uniquement les champs remplis ci-dessous.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={content.heroShowOverlay}
                  onClick={() => updateField("heroShowOverlay", !content.heroShowOverlay)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    content.heroShowOverlay ? "bg-white" : "bg-zinc-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-black transition-transform ${
                      content.heroShowOverlay ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-5 ${
                content.heroShowOverlay ? "" : "opacity-45 pointer-events-none"
              }`}
            >
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                  Nom de la collection
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={content.heroCollection}
                    onChange={(e) => updateField("heroCollection", e.target.value)}
                    placeholder="Vide = masqué"
                    className="flex-1 min-w-0 border border-zinc-600 bg-white text-black placeholder:text-zinc-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
                  />
                  <input
                    type="color"
                    value={(content.heroCollectionColor || "#ffffff").replace(/^([^#])/, "#$1")}
                    onChange={(e) => updateField("heroCollectionColor", e.target.value)}
                    className="w-9 h-9 rounded border border-zinc-600 cursor-pointer bg-white p-0.5"
                    title="Couleur du texte"
                  />
                </div>
              </div>
            </div>

            <div
              className={`space-y-1.5 ${content.heroShowOverlay ? "" : "opacity-45 pointer-events-none"}`}
            >
              <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                Main title (use \n for a line break)
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={content.heroHeadline.replace(/\n/g, "\\n")}
                  onChange={(e) =>
                    updateField("heroHeadline", e.target.value.replace(/\\n/g, "\n"))
                  }
                  placeholder="Vide = masqué"
                  className="flex-1 min-w-0 border border-zinc-600 bg-white text-black placeholder:text-zinc-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
                />
                <input
                  type="color"
                  value={(content.heroHeadlineColor || "#ffffff").replace(/^([^#])/, "#$1")}
                  onChange={(e) => updateField("heroHeadlineColor", e.target.value)}
                  className="w-9 h-9 rounded border border-zinc-600 cursor-pointer bg-white p-0.5"
                  title="Couleur du texte"
                />
              </div>
            </div>

            <div
              className={`space-y-1.5 ${content.heroShowOverlay ? "" : "opacity-45 pointer-events-none"}`}
            >
              <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                Description
              </label>
              <div className="flex gap-2 items-start">
                <textarea
                  value={content.heroDescription}
                  onChange={(e) => updateField("heroDescription", e.target.value)}
                  rows={2}
                  placeholder="Vide = masqué"
                  className="flex-1 min-w-0 border border-zinc-600 bg-white text-black placeholder:text-zinc-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors resize-none"
                />
                <input
                  type="color"
                  value={(content.heroDescriptionColor || "#ffffff").replace(/^([^#])/, "#$1")}
                  onChange={(e) => updateField("heroDescriptionColor", e.target.value)}
                  className="w-9 h-9 rounded border border-zinc-600 cursor-pointer bg-white p-0.5 shrink-0 mt-1"
                  title="Couleur du texte"
                />
              </div>
            </div>

            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-5 ${
                content.heroShowOverlay ? "" : "opacity-45 pointer-events-none"
              }`}
            >
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                  Bouton principal
                </label>
                <input
                  type="text"
                  value={content.heroButtonText}
                  onChange={(e) => updateField("heroButtonText", e.target.value)}
                  placeholder="Vide = masqué (ex. Shop now)"
                  className="w-full border border-zinc-600 bg-white text-black placeholder:text-zinc-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                  Bouton secondaire
                </label>
                <input
                  type="text"
                  value={content.heroSecondaryButtonText ?? ""}
                  onChange={(e) => updateField("heroSecondaryButtonText", e.target.value)}
                  placeholder="Vide = masqué (ex. Voir les nouveautés)"
                  className="w-full border border-zinc-600 bg-white text-black placeholder:text-zinc-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
                />
              </div>
            </div>

          </div>

          {/* Live Preview */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-4 sm:p-6 text-white">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Aperçu avec textes</p>
            {selectedHeroPreviewUrl && (
              <div className="relative aspect-video w-full rounded overflow-hidden mb-4 bg-black">
                <img
                  src={selectedHeroPreviewUrl}
                  alt="Hero preview"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            {content.heroShowOverlay ? (
              <div className="space-y-2">
                {content.heroCollection.trim() ? (
                  <p className="text-lg font-black uppercase tracking-wide" style={{ color: content.heroCollectionColor || "#ffffff" }}>{content.heroCollection}</p>
                ) : null}
                {content.heroHeadline.trim() ? (
                  <h2 className="text-2xl sm:text-3xl font-black uppercase leading-tight whitespace-pre-line" style={{ color: content.heroHeadlineColor || "#ffffff" }}>
                    {content.heroHeadline}
                  </h2>
                ) : null}
                {content.heroDescription.trim() ? (
                  <p className="text-sm" style={{ color: content.heroDescriptionColor || "#ffffff" }}>{content.heroDescription}</p>
                ) : null}
                {(content.heroButtonText.trim() || (content.heroSecondaryButtonText ?? "").trim()) ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {content.heroButtonText.trim() ? (
                      <span className="inline-flex bg-white px-3 py-1.5 text-xs font-semibold text-black">
                        {content.heroButtonText}
                      </span>
                    ) : null}
                    {(content.heroSecondaryButtonText ?? "").trim() ? (
                      <span className="inline-flex border border-white px-3 py-1.5 text-xs font-semibold text-white">
                        {content.heroSecondaryButtonText}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {!content.heroCollection.trim() &&
                !content.heroHeadline.trim() &&
                !content.heroDescription.trim() &&
                !content.heroButtonText.trim() &&
                !(content.heroSecondaryButtonText ?? "").trim() ? (
                  <p className="text-xs text-zinc-500">Aucun texte renseigné — le hero affichera seulement les images.</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Textes désactivés — le hero affichera seulement les images.</p>
            )}

          </div>
        </div>
      )}

      {/* Bandeau (phrases du bandeau en haut du site) */}
      {activeTab === "bandeau" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-700 bg-black p-4 sm:p-6 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <PanelTop className="h-4 w-4" />
              Phrases du bandeau
            </h2>
            <p className="text-xs text-zinc-400">
              Ces phrases défilent en boucle en haut du site. Modifiez l’ordre ou le texte, puis enregistrez.
            </p>
            <div className="space-y-3">
              {(content.bannerPhrases || []).map((phrase, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="text-zinc-500 text-xs w-7 shrink-0">{index + 1}.</span>
                  <input
                    type="text"
                    value={phrase}
                    onChange={(e) => updateBannerPhrase(index, e.target.value)}
                    placeholder="Nouvelle phrase"
                    className="flex-1 min-w-0 border border-zinc-600 bg-white text-black placeholder:text-zinc-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => removeBannerPhrase(index)}
                    className="p-2 border border-zinc-600 rounded text-zinc-400 hover:text-red-400 hover:border-red-400 transition-colors shrink-0"
                    title="Supprimer"
                    disabled={(content.bannerPhrases || []).length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addBannerPhrase}
                className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-600 rounded text-zinc-300 text-xs font-semibold uppercase tracking-wider hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <Plus className="h-4 w-4" />
                Ajouter une phrase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Section Editor */}
      {activeTab === "products" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-700 bg-black p-4 sm:p-6 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Carrousel Produits
            </h2>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                Section title
              </label>
              <input
                type="text"
                value={content.carouselTitle}
                onChange={(e) => updateField("carouselTitle", e.target.value)}
                placeholder="e.g. The Latest /n Arrivals"
                className="w-full sm:max-w-md border border-zinc-600 bg-white text-black placeholder:text-zinc-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
              />
              <p className="text-[10px] text-zinc-400">Use /n for a line break (e.g. The Latest /n Arrivals)</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                  Produits ({content.products.length})
                </label>
                <button
                  onClick={addProduct}
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white hover:text-zinc-300 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter
                </button>
              </div>

              <div className="space-y-2">
                {content.products.map((product, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 border border-zinc-600 rounded bg-zinc-800"
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-zinc-400 w-6 text-center">{index + 1}</span>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => moveProduct(index, "up")}
                          disabled={index === 0}
                          className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveProduct(index, "down")}
                          disabled={index === content.products.length - 1}
                          className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <select
                      value={product.product_id ?? ""}
                      onChange={(e) => selectProduct(index, e.target.value)}
                      className="flex-1 min-w-0 border border-zinc-600 bg-white text-black rounded px-3 py-1.5 text-sm focus:outline-none focus:border-white"
                    >
                      <option value="">Select product…</option>
                      {shopProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} – {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND", minimumFractionDigits: 2 }).format(p.discount_price ?? p.price)}
                        </option>
                      ))}
                    </select>
                    {product.name && (
                      <span className="text-xs text-zinc-400 truncate sm:max-w-[120px]">{product.name}</span>
                    )}
                    <button
                      onClick={() => removeProduct(index)}
                      className="text-zinc-400 hover:text-red-400 transition-colors p-1.5 shrink-0"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories Section Editor */}
      {activeTab === "categories" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-700 bg-black p-4 sm:p-6 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Categories grid
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                    Category 1 – Nom
                  </label>
                  <input
                    type="text"
                    value={content.category1Name}
                    onChange={(e) => updateField("category1Name", e.target.value)}
                    className="w-full border border-zinc-600 bg-white text-black placeholder:text-zinc-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Image Category 1
                  </label>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black border border-white rounded text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-zinc-100 hover:border-zinc-100 transition-colors w-fit">
                      <Upload className="h-4 w-4" />
                      {cat1Uploading ? "Upload…" : "Choisir une image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={cat1Uploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setCat1UploadError(null);
                          setCat1Uploading(true);
                          try {
                            const url = await uploadHomeImage("category1", file);
                            updateField("category1ImageUrl", url);
                          } catch (err) {
                            setCat1UploadError(err instanceof Error ? err.message : "Upload failed");
                          } finally {
                            setCat1Uploading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                    {content.category1ImageUrl && (
                      <div className="relative aspect-[4/3] max-w-[200px] rounded overflow-hidden bg-zinc-800">
                        <img src={content.category1ImageUrl} alt="Category 1" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <button
                          type="button"
                          onClick={() => updateField("category1ImageUrl", "")}
                          className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded hover:bg-black"
                          aria-label="Supprimer l'image"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {cat1UploadError && <p className="text-xs text-red-400">{cat1UploadError}</p>}
                    <p className="text-[10px] text-zinc-400">Best quality: high‑res JPEG, PNG or WebP.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                    Category 2 – Nom
                  </label>
                  <input
                    type="text"
                    value={content.category2Name}
                    onChange={(e) => updateField("category2Name", e.target.value)}
                    className="w-full border border-zinc-600 bg-white text-black placeholder:text-zinc-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Image Category 2
                  </label>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black border border-white rounded text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-zinc-100 hover:border-zinc-100 transition-colors w-fit">
                      <Upload className="h-4 w-4" />
                      {cat2Uploading ? "Upload…" : "Choisir une image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={cat2Uploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setCat2UploadError(null);
                          setCat2Uploading(true);
                          try {
                            const url = await uploadHomeImage("category2", file);
                            updateField("category2ImageUrl", url);
                          } catch (err) {
                            setCat2UploadError(err instanceof Error ? err.message : "Upload failed");
                          } finally {
                            setCat2Uploading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                    {content.category2ImageUrl && (
                      <div className="relative aspect-[4/3] max-w-[200px] rounded overflow-hidden bg-zinc-800">
                        <img src={content.category2ImageUrl} alt="Category 2" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <button
                          type="button"
                          onClick={() => updateField("category2ImageUrl", "")}
                          className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded hover:bg-black"
                          aria-label="Supprimer l'image"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {cat2UploadError && <p className="text-xs text-red-400">{cat2UploadError}</p>}
                    <p className="text-[10px] text-zinc-400">Best quality: high‑res JPEG, PNG or WebP.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview – images only */}
          <div className="rounded-lg border border-zinc-200 overflow-hidden">
            <div className="grid grid-cols-2 h-40">
              <div className="relative bg-zinc-200 overflow-hidden">
                {content.category1ImageUrl && content.category1ImageUrl.startsWith("http") ? (
                  <img src={content.category1ImageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : null}
              </div>
              <div className="relative bg-zinc-200 overflow-hidden">
                {content.category2ImageUrl && content.category2ImageUrl.startsWith("http") ? (
                  <img src={content.category2ImageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer / Newsletter Section Editor */}
      {activeTab === "footer" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-700 bg-black p-4 sm:p-6 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Newsletter & Pied de page
            </h2>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                Texte de la newsletter
              </label>
              <textarea
                value={content.newsletterText}
                onChange={(e) => updateField("newsletterText", e.target.value)}
                rows={2}
                className="w-full border border-zinc-600 bg-white text-black placeholder:text-zinc-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                Identifiant social
              </label>
              <input
                type="text"
                value={content.socialHandle}
                onChange={(e) => updateField("socialHandle", e.target.value)}
                className="w-full sm:max-w-xs border border-zinc-600 bg-white text-black placeholder:text-zinc-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {/* Coming soon / Password gate */}
      {activeTab === "comingSoon" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-700 bg-black p-4 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Coming soon (block site)
              </h2>
              <button
                onClick={saveComingSoon}
                disabled={comingSoonSaving}
                className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all duration-200 ${
                  comingSoonSaved
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-black hover:bg-zinc-100 disabled:opacity-60"
                }`}
              >
                {comingSoonSaved ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </>
                )}
              </button>
            </div>

            {comingSoonError && <p className="text-xs text-red-400">{comingSoonError}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                  Enable gate
                </label>
                <button
                  type="button"
                  onClick={() => setComingSoon((p) => ({ ...p, enabled: !p.enabled }))}
                  className={`w-full sm:w-fit px-4 py-2 rounded text-xs font-bold uppercase tracking-wider border transition-colors ${
                    comingSoon.enabled ? "bg-emerald-600 border-emerald-600 text-white" : "bg-transparent border-zinc-600 text-zinc-300 hover:border-white hover:text-white"
                  }`}
                >
                  {comingSoon.enabled ? "Enabled" : "Disabled"}
                </button>
                <p className="text-[10px] text-zinc-400">
                  When enabled, visitors can only see the coming soon screen (no access to other pages).
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-white">
                  Countdown end time
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "+30m", minutes: 30 },
                    { label: "+1h", minutes: 60 },
                    { label: "+6h", minutes: 6 * 60 },
                    { label: "+24h", minutes: 24 * 60 },
                    { label: "+7d", minutes: 7 * 24 * 60 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setEndIn(p.minutes)}
                      className="px-3 py-2 border border-zinc-600 rounded text-[10px] font-bold uppercase tracking-wider text-zinc-200 hover:border-white hover:text-white transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:max-w-md">
                  <input
                    type="date"
                    value={comingSoon.endAt ? new Date(comingSoon.endAt).toISOString().slice(0, 10) : ""}
                    onChange={(e) => {
                      const datePart = e.target.value;
                      const timePart = comingSoon.endAt ? new Date(comingSoon.endAt).toISOString().slice(11, 16) : "12:00";
                      if (!datePart) {
                        setComingSoon((p) => ({ ...p, endAt: "" }));
                        return;
                      }
                      setEndFromParts(datePart, timePart);
                    }}
                    className="w-full border border-zinc-600 bg-white text-black rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
                  />
                  <input
                    type="time"
                    value={comingSoon.endAt ? new Date(comingSoon.endAt).toISOString().slice(11, 16) : ""}
                    onChange={(e) => {
                      const timePart = e.target.value;
                      const datePart = comingSoon.endAt ? new Date(comingSoon.endAt).toISOString().slice(0, 10) : "";
                      if (!datePart || !timePart) return;
                      setEndFromParts(datePart, timePart);
                    }}
                    className="w-full border border-zinc-600 bg-white text-black rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setComingSoon((p) => ({ ...p, endAt: "" }))}
                  className="text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white w-fit"
                >
                  Clear time
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5" />
                Background image (1920×1080)
              </label>
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black border border-white rounded text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-zinc-100 hover:border-zinc-100 transition-colors">
                  <Upload className="h-4 w-4" />
                  {comingSoonUploading ? "Upload…" : "Choose image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={comingSoonUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setComingSoonUploadError(null);
                      setComingSoonUploading(true);
                      try {
                        await validateComingSoonImage(file);
                        const url = await uploadComingSoonImage(file);
                        setComingSoon((p) => ({ ...p, heroImageUrl: url }));
                      } catch (err) {
                        setComingSoonUploadError(err instanceof Error ? err.message : "Upload failed");
                      } finally {
                        setComingSoonUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                {comingSoon.heroImageUrl && (
                  <button
                    type="button"
                    onClick={() => setComingSoon((p) => ({ ...p, heroImageUrl: "" }))}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-600 rounded text-zinc-300 text-xs font-semibold uppercase tracking-wider hover:bg-zinc-800 hover:text-white transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove image
                  </button>
                )}
              </div>
              {comingSoonUploadError && <p className="text-xs text-red-400">{comingSoonUploadError}</p>}
              <p className="text-[10px] text-zinc-400">Required: 16:9 ratio, minimum 1376×768 (recommended 1920×1080). JPEG, PNG, WebP or GIF.</p>
              {comingSoon.heroImageUrl && comingSoon.heroImageUrl.startsWith("http") && (
                <div className="mt-3 relative aspect-video w-full rounded overflow-hidden border border-zinc-600 bg-black">
                  <img
                    src={comingSoon.heroImageUrl}
                    alt="Coming soon preview"
                    className="w-full h-full object-cover object-center"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg border border-zinc-600/80 bg-zinc-950 p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-white/80" />
                  <p className="text-xs font-bold uppercase tracking-wider text-white">Password (optional)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setComingSoon((p) => ({ ...p, requirePassword: !p.requirePassword }))}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border rounded ${
                    comingSoon.requirePassword ? "bg-white text-black border-white" : "bg-transparent text-zinc-300 border-zinc-600 hover:border-white hover:text-white"
                  }`}
                >
                  {comingSoon.requirePassword ? "Required" : "No password"}
                </button>
              </div>
              {comingSoon.requirePassword && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                      Set / change password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewComingSoonPassword ? "text" : "password"}
                        value={comingSoon.newPassword || ""}
                        onChange={(e) => setComingSoon((p) => ({ ...p, newPassword: e.target.value }))}
                        className="w-full border border-zinc-600 bg-white text-black placeholder:text-zinc-400 rounded px-3 py-2 pr-10 text-sm focus:outline-none focus:border-white transition-colors"
                        placeholder="New password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewComingSoonPassword((p) => !p)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-black"
                        aria-label={showNewComingSoonPassword ? "Hide password" : "Show password"}
                      >
                        {showNewComingSoonPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      Leave empty to keep existing password.
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      Current password: <span className="font-semibold">{comingSoonHasPassword ? "set" : "not set"}</span>
                    </p>
                    {lastSavedComingSoonPassword ? (
                      <div className="mt-2 rounded border border-zinc-700 bg-zinc-900/40 p-2.5">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">
                          Last saved password (this browser)
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs text-white/90 break-all">
                            {showLastSavedComingSoonPassword ? lastSavedComingSoonPassword : "••••••••••"}
                          </code>
                          <button
                            type="button"
                            onClick={() => setShowLastSavedComingSoonPassword((p) => !p)}
                            className="p-1.5 border border-zinc-600 rounded text-zinc-300 hover:text-white hover:border-white transition-colors"
                            aria-label={showLastSavedComingSoonPassword ? "Hide last password" : "Show last password"}
                          >
                            {showLastSavedComingSoonPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(lastSavedComingSoonPassword);
                              } catch {}
                            }}
                            className="px-2.5 py-1.5 border border-zinc-600 rounded text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:text-white hover:border-white transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setLastSavedComingSoonPassword("");
                            try {
                              localStorage.removeItem("bt_cs_last_password");
                            } catch {}
                          }}
                          className="mt-2 text-[10px] uppercase tracking-widest text-zinc-500 hover:text-white"
                        >
                          Forget on this device
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    Visitors must enter the password once (cookie saved) to access the site while the gate is enabled.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

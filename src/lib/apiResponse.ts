import { NextResponse } from "next/server";
import { API_CACHE_HEADERS } from "@/lib/cacheHeaders";

type JsonInit = Omit<ResponseInit, "headers"> & { headers?: HeadersInit };

/** JSON API response with no-store headers (prevents Safari/proxy caching). */
export function apiJsonResponse<T>(body: T, init?: JsonInit): NextResponse {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(API_CACHE_HEADERS)) {
    headers.set(key, value);
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return NextResponse.json(body, { ...init, headers });
}

/** Attach no-store headers to an existing Response (e.g. serialized JSON). */
export function withApiNoStoreHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(API_CACHE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

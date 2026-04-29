type ApiResponse<T = any> = { data: T; error: { message: string } | null; count?: number | null };
type Filter = { op: "eq" | "in"; column: string; value: unknown };

async function callNeon<T = any>(payload: Record<string, unknown>): Promise<ApiResponse<T>> {
  const res = await fetch("/api/neon/table", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const message = json?.error || `Requete echouee (${res.status})`;
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      console.error("[api/neon/table]", message);
    }
    return { data: null as any, error: { message }, count: null };
  }
  return {
    data: (json?.data ?? null) as T,
    error: json?.error ? { message: String(json.error) } : null,
    count: json?.count ?? null,
  };
}

class SelectBuilder {
  private filters: Filter[] = [];
  private orderBy?: string;
  private ascending = true;
  private shouldSingle = false;
  private shouldMaybeSingle = false;

  constructor(private table: string, private selectCols: string, private options?: { count?: string; head?: boolean }) {}

  eq(column: string, value: unknown) { this.filters.push({ op: "eq", column, value }); return this; }
  in(column: string, value: unknown[]) { this.filters.push({ op: "in", column, value }); return this; }
  order(column: string, opts?: { ascending?: boolean }) { this.orderBy = column; this.ascending = opts?.ascending !== false; return this; }
  single() { this.shouldSingle = true; return this.execute(); }
  maybeSingle() { this.shouldMaybeSingle = true; return this.execute(); }

  async execute() {
    const r = await callNeon<any[]>({
      action: "select",
      table: this.table,
      select: this.selectCols,
      filters: this.filters,
      orderBy: this.orderBy,
      ascending: this.ascending,
      count: this.options?.count,
      head: this.options?.head,
    });
    if (r.error) return { data: null, error: r.error, count: r.count ?? null };
    const rows = Array.isArray(r.data) ? r.data : [];
    if (this.shouldSingle) return { data: rows[0] ?? null, error: rows[0] ? null : { message: "No rows" }, count: r.count ?? null };
    if (this.shouldMaybeSingle) return { data: rows[0] ?? null, error: null, count: r.count ?? null };
    return { data: this.options?.head ? null : rows, error: null, count: r.count ?? null };
  }

  then<TResult1 = any, TResult2 = never>(onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null) {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }
}

class MutBuilder {
  private filters: Filter[] = [];
  constructor(private action: "update" | "delete", private table: string, private values?: Record<string, unknown>) {}
  eq(column: string, value: unknown) { this.filters.push({ op: "eq", column, value }); return this.execute(); }
  in(column: string, value: unknown[]) { this.filters.push({ op: "in", column, value }); return this.execute(); }
  async execute() { return callNeon({ action: this.action, table: this.table, values: this.values, filters: this.filters }); }
}

export const supabaseBrowserClient = () => ({
  from(table: string) {
    return {
      select: (cols: string, opts?: { count?: string; head?: boolean }) => new SelectBuilder(table, cols, opts),
      insert: (values: Record<string, unknown> | Record<string, unknown>[]) => callNeon({ action: "insert", table, values }),
      upsert: (values: Record<string, unknown>, opts?: { onConflict?: string }) => callNeon({ action: "upsert", table, values, onConflict: opts?.onConflict }),
      update: (values: Record<string, unknown>) => new MutBuilder("update", table, values),
      delete: () => new MutBuilder("delete", table),
    };
  },
});

export const supabaseServerOnlyClient = supabaseBrowserClient;

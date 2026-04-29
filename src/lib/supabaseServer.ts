import { neonQuery } from "@/lib/neon-db";

export const supabaseServerClient = () => ({
  storage: {
    async listBuckets() {
      return { data: [], error: null };
    },
    async createBucket() {
      return { data: null, error: null };
    },
    from() {
      return {
        async upload() {
          return { error: { message: "Supabase storage removed. Use local uploads." } };
        },
        getPublicUrl() {
          return { data: { publicUrl: "" } };
        },
      };
    },
  },
  neonQuery,
});

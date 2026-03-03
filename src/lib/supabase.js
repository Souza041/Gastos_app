import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error("Faltou VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY no .env");
}

export const supabase = createClient(url, anon);
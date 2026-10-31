import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://rqfowcryfabosmsmuszt.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZKPdrhypEujrp4ZZy54Kbg_8PKiaYKy";

console.log("URL:", SUPABASE_URL);
console.log("URL válida:", /^https?:\/\/.+/.test(SUPABASE_URL));

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


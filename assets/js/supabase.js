
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

// Substitua pelos dados do seu projeto
const SUPABASE_URL = "COLE_AQUI_SUA_PROJECT_URL";
const SUPABASE_KEY = "COLE_AQUI_SUA_PUBLISHABLE_KEY";

// Inicializar conexão
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

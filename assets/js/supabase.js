
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

// Substitua pelos dados do seu projeto
const SUPABASE_URL = "sb_publishable_ZKPdrhypEujrp4ZZy54Kbg_8PKiaYKy";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZm93Y3J5ZmFib3Ntc211c3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NTIwMzcsImV4cCI6MjEwOTAyODAzN30.rDAbPaen8XRiw69n4RsjbrzSaUNVahEV6UbhCt-HC6k";

// Inicializar conexão
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

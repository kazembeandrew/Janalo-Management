import { supabase as standardClient } from "@/integrations/supabase/client";

// Re-export the standard client to maintain compatibility with existing imports
export const supabase = standardClient;
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto"; // Required for Supabase in React Native

// Supabase project credentials
const supabaseUrl = "https://qficnecwziquhzlocyhl.supabase.co";
const supabaseAnonKey = "sb_publishable_oWW5lqaysa0r894sftFjdQ_PC0eVAc3";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

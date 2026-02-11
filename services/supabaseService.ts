import { createClient } from '@supabase/supabase-js';
import { FormData, GeneratedAsset } from '../types';

const supabaseUrl = 'https://lnhqonvgclsgsehjsaob.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaHFvbnZnY2xzZ3NlaGpzYW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NTQyOTEsImV4cCI6MjA4NjMzMDI5MX0.Oq0HA2udJFN5tWcffkJahh9SKfI62pbrZsFO_PQD8m8';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface SavedGeneration {
  id: string;
  created_at: string;
  brand_name: string;
  product_type: string;
  input_brief: FormData;
  output_plan: GeneratedAsset;
  user_id?: string;
}

// --- Auth Methods ---

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin, // Redirect back to this app
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) throw error;
  return data;
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signUpWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// --- Database Methods ---

export const saveGeneration = async (input: FormData, output: GeneratedAsset) => {
  // Try to get current user, but proceed even if anon
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('ugc_generations')
    .insert([
      {
        brand_name: input.brand.name,
        product_type: input.product.type,
        input_brief: input,
        output_plan: output,
        user_id: user?.id || null
      },
    ])
    .select();

  if (error) {
    console.error('Supabase Save Error:', error);
    // We don't throw here to prevent blocking the UI if backend fails
    return null;
  }
  return data?.[0] as SavedGeneration;
};

export const fetchHistory = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  let query = supabase
    .from('ugc_generations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  // If we had strict RLS, we would need user. But for this demo, we might fetch global or user specific.
  // Assuming the table allows reading own rows or public rows.
  if (user) {
    query = query.eq('user_id', user.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Supabase Fetch Error:', error);
    return [];
  }
  return data as SavedGeneration[];
};
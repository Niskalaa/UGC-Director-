import { createClient } from '@supabase/supabase-js';
import { FormData, GeneratedAsset } from '../types';

const supabaseUrl = 'https://lnhqonvgclsgsehjsaob.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaHFvbnZnY2xzZ3NlaGpzYW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NTQyOTEsImV4cCI6MjA4NjMzMDI5MX0.Oq0HA2udJFN5tWcffkJahh9SKfI62pbrZsFO_PQD8m8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SavedGeneration {
  id: string;
  created_at: string;
  brand_name: string;
  product_type: string;
  input_brief: FormData;
  output_plan: GeneratedAsset;
  user_id?: string;
}

export const saveGeneration = async (input: FormData, output: GeneratedAsset) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('ugc_generations')
    .insert([
      {
        brand_name: input.brand.name,
        product_type: input.product.type,
        input_brief: input,
        output_plan: output,
        user_id: user?.id
      },
    ])
    .select();

  if (error) {
    console.error('Supabase Save Error:', error);
    throw error;
  }
  return data?.[0] as SavedGeneration;
};

export const fetchHistory = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('ugc_generations')
    .select('id, created_at, brand_name, product_type, input_brief, output_plan')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Supabase Fetch Error:', error);
    return [];
  }
  return data as SavedGeneration[];
};

import { createClient } from '@supabase/supabase-js';
import { FormData, GeneratedAsset } from '../types';

const supabaseUrl = 'https://lnhqonvgclsgsehjsaob.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaHFvbnZnY2xzZ3NlaGpzYW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NTQyOTEsImV4cCI6MjA4NjMzMDI5MX0.Oq0HA2udJFN5tWcffkJahh9SKfI62pbrZsFO_PQD8m8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/*
  ### SUPABASE SQL SCHEMA
  Run this in your Supabase SQL Editor to create the required table:

  create table public.ugc_generations (
    id uuid not null default gen_random_uuid (),
    created_at timestamp with time zone not null default timezone ('utc'::text, now()),
    user_id uuid null default auth.uid (),
    brand_name text null,
    product_type text null,
    input_brief jsonb null,
    output_plan jsonb null,
    constraint ugc_generations_pkey primary key (id),
    constraint ugc_generations_user_id_fkey foreign key (user_id) references auth.users (id)
  );

  -- Enable RLS
  alter table public.ugc_generations enable row level security;

  -- Policy: Allow users to select their own data
  create policy "Users can view own generations"
  on public.ugc_generations for select
  to authenticated
  using (auth.uid() = user_id);

  -- Policy: Allow users to insert their own data
  create policy "Users can insert own generations"
  on public.ugc_generations for insert
  to authenticated
  with check (auth.uid() = user_id);

  -- Policy: Allow users to delete their own data
  create policy "Users can delete own generations"
  on public.ugc_generations for delete
  to authenticated
  using (auth.uid() = user_id);
  
  -- Policy: Allow users to update their own data
  create policy "Users can update own generations"
  on public.ugc_generations for update
  to authenticated
  using (auth.uid() = user_id);
*/

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

export const updateGeneration = async (id: string, output: GeneratedAsset) => {
  const { error } = await supabase
    .from('ugc_generations')
    .update({ output_plan: output })
    .eq('id', id);

  if (error) {
    console.error('Supabase Update Error:', error);
  }
};

export const fetchHistory = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  let query = supabase
    .from('ugc_generations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  // Filter by user_id to ensure we only see (and thus can delete) our own records
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

export const deleteGeneration = async (id: string) => {
  const { error } = await supabase
    .from('ugc_generations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Supabase Delete Error:', error);
    throw error;
  }
};

// Where the shared garden lives online (v1.1): Stef's free Supabase project.
//
// Both values come from Supabase → Project Settings → API Keys (and Data API for the URL).
// They're safe to have in a public repo: the "publishable" key only lets a phone
// sign in quietly, and the rules in supabase/setup.sql only ever show a phone the
// gardens it has joined with an invite code.
//
// Leave them empty and Mary Mary works exactly as before, on one phone.

export const SUPABASE_URL = "";
export const SUPABASE_KEY = "";

export function cloudReady(url = SUPABASE_URL, key = SUPABASE_KEY): boolean {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && key.length > 20;
}

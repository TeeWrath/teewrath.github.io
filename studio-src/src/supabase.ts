import type { SupabaseClient } from '@supabase/supabase-js';
// `@client` is the real Supabase client, or an in-memory fake under `vite --mode demo` (see vite.config.ts).
import { client, SUPABASE_URL, SUPABASE_ANON_KEY } from '@client';

export { SUPABASE_URL, SUPABASE_ANON_KEY };
export const AUTHOR_EMAIL = 'subroto.2003@gmail.com';
export const BUCKET = 'blog-images';

export const supabase = client as SupabaseClient;

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  cover_url: string | null;
  cover_alt: string;
  content_json: unknown;
  content_html: string;
  reading_min: number;
  seo_title: string;
  seo_desc: string;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

// Resize + re-encode before upload so a 12MB phone photo doesn't hit the blog.
export async function uploadImage(file: File): Promise<string> {
  let blob: Blob = file;
  let ext = (file.name.split('.').pop() || 'png').toLowerCase();
  if (/^image\/(png|jpe?g|webp)$/.test(file.type)) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / bmp.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.86));
    if (out && out.size < file.size) {
      blob = out;
      ext = 'webp';
    }
  }
  const d = new Date();
  const path = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || undefined, cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

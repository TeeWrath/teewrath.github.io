// Dev-only fake Supabase for `npm run demo` — lets the UI be exercised without a backend or login.
// Tree-shaken out of production builds (see src/supabase.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */
const now = Date.now();
const day = 86400e3;
const iso = (offset: number) => new Date(now - offset * day).toISOString();
const lorem = (n: number) => Array.from({ length: n }, () => 'Writing is thinking made visible, and a good tool should get out of the way so the thinking can happen. This paragraph exists to show how long lines of body copy feel at the chosen measure and size.').join(' ');

const seed = (i: number, title: string, category: string, status: 'draft' | 'published', off: number, cover?: string) => ({
  id: 'demo-' + i, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, excerpt: `A short summary of “${title}” that shows up in the blog list.`,
  category, tags: ['flutter', 'dart'].slice(0, (i % 2) + 1), cover_url: cover ?? null, cover_alt: '', content_json: null,
  content_html: `<p>${lorem(2)}</p><h2>Why it matters</h2><p>${lorem(2)}</p><blockquote><p>Simple is hard. Hard is worth it.</p></blockquote><h3>A code sample</h3><pre><code class="language-dart">void main() {\n  runApp(const MyApp());\n}</code></pre><div data-callout="tip" class="callout"><p>Tip: type <code>/</code> to insert blocks.</p></div><p>${lorem(1)}</p>`,
  reading_min: 3 + i, seo_title: '', seo_desc: '', status, published_at: status === 'published' ? iso(off) : null,
  created_at: iso(off + 2), updated_at: iso(off),
});
const gradient = (a: string, b: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`);

let rows: any[] = [
  seed(1, 'Introducing CookethFlow Web', 'Flutter', 'published', 12, gradient('#4f46e5', '#06b6d4')),
  seed(2, 'Masking Images in Flutter', 'Flutter', 'published', 80, gradient('#f97316', '#ec4899')),
  seed(3, 'C++ or Java for beginners', 'Programming', 'published', 200, gradient('#10b981', '#3b82f6')),
  seed(4, 'Notes on building in public', 'Build in Public', 'draft', 2),
  seed(5, 'Untitled idea about state management', 'Flutter', 'draft', 1),
];
rows[1].published_at = new Date(now + 6 * day).toISOString(); // scheduled

const clone = (x: any) => JSON.parse(JSON.stringify(x));
const blobs = new Map<string, string>();
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60));

class Query {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any; private filters: [string, any][] = []; private orderBy?: [string, boolean]; private one = false; private cols = '*';
  constructor(private table: string) {}
  select(cols = '*') { this.cols = cols; return this; }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: any) { this.filters.push([c, v]); return this; }
  is(c: string, v: any) { this.filters.push([c, v]); return this; }
  in(c: string, vs: any[]) { this.filters.push([c, { __in: vs }]); return this; }
  order(c: string, o: { ascending: boolean }) { this.orderBy = [c, o.ascending]; return this; }
  single() { this.one = true; return this; }
  then(res: any, rej: any) { return this.run().then(res, rej); }
  private async run() {
    const match = (r: any) => this.filters.every(([c, v]) => (v && v.__in ? v.__in.includes(r[c]) : r[c] === v));
    if (this.op === 'insert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p) => ({
        id: 'demo-' + Math.random().toString(36).slice(2, 9), excerpt: '', category: '', tags: [], cover_url: null, cover_alt: '', content_json: null, content_html: '',
        reading_min: 1, seo_title: '', seo_desc: '', status: 'draft', published_at: null, title: 'Untitled', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...p,
      }));
      rows = [...rows, ...list];
      return wait({ data: this.one ? list[0] : list, error: null });
    }
    if (this.op === 'update') {
      rows = rows.map((r) => (match(r) ? { ...r, ...this.payload, updated_at: new Date().toISOString() } : r));
      return wait({ data: null, error: null });
    }
    if (this.op === 'delete') { rows = rows.filter((r) => !match(r)); return wait({ data: null, error: null }); }
    let out = rows.filter(match).map(clone);
    if (this.orderBy) { const [c, asc] = this.orderBy; out.sort((a, b) => (a[c] > b[c] ? 1 : -1) * (asc ? 1 : -1)); }
    return wait({ data: this.one ? out[0] ?? null : out, error: this.one && !out[0] ? { message: 'not found' } : null });
  }
}

const session = { user: { email: 'subroto.2003@gmail.com' } };
export const SUPABASE_URL = 'demo://local';
export const SUPABASE_ANON_KEY = 'demo';
export const client: any = {
  auth: {
    getSession: () => Promise.resolve({ data: { session } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: () => Promise.resolve(),
    signInWithPassword: () => Promise.resolve({ error: null }),
  },
  from: (t: string) => new Query(t),
  storage: {
    from: () => ({
      upload: (path: string, blob: Blob) => { blobs.set(path, URL.createObjectURL(blob)); return Promise.resolve({ error: null }); },
      getPublicUrl: (path: string) => ({ data: { publicUrl: blobs.get(path) || '' } }),
    }),
  },
};

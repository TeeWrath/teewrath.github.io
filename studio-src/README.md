# Studio

Writing app for teewrath.github.io. Source lives here; the build is committed to `/studio`.

- Develop: `cd studio-src && npm install && npm run dev`
- Build:   `npm run build` (outputs to `../studio`, commit it)
- One-time backend setup: run `supabase/setup.sql` in the Supabase SQL editor, then add the
  author user (Authentication → Users → Add user, auto-confirm) with email `subroto.2003@gmail.com`.
- Only that email can write (RLS). The public site reads published posts via `assets/js/studio-posts.js`.

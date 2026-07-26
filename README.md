# Personal portfolio

![GitHub repo size](https://img.shields.io/github/repo-size/TeeWrath/teewrath.github.io)
![GitHub stars](https://img.shields.io/github/stars/TeeWrath/teewrath.github.io?style=social)
![GitHub forks](https://img.shields.io/github/forks/TeeWrath/teewrath.github.io?style=social)
[![Twitter Follow](https://img.shields.io/twitter/follow/Subroto0108?style=social)](https://twitter.com/intent/follow?screen_name=Subroto0108)


## Writing a blog post

This site hosts your own writing — no backend, no build step.

**To publish a new post of your own:**

1. Create a Markdown file in `blog/posts/`, e.g. `blog/posts/my-post.md`.
2. Add one entry to `blog/posts.json`:
   ```json
   {
     "id": "my-post",
     "type": "self",
     "title": "My Post Title",
     "category": "Flutter",
     "date": "2026-06-10",
     "cover": "./assets/images/some-image.png",
     "excerpt": "One-line summary shown on the card.",
     "file": "./blog/posts/my-post.md"
   }
   ```
   - `id` must match the file name (without `.md`) and be URL-safe.
   - `cover` is optional — set it to `null` for a generated monochrome cover.
3. Commit and push. The post appears under **Blog → Mine** and opens at `post.html?id=my-post`.

**To add an external post** (Medium, Substack, Hashnode, etc.), add an entry with
`"type": "external"` and a `"url"` instead of `"file"`. It shows under **Blog → External**
and links out.

> Note: the blog loads `blog/posts.json` via `fetch`, so preview locally with a server
> (`python3 -m http.server`) rather than opening `index.html` from the file system.

## Project launch pages

Every project has its own page at `project.html?id=<slug>`, driven by
`projects/projects.json`. Each entry:

```json
{
  "id": "cooketh-flow",
  "title": "Cooketh Flow",
  "category": "applications",
  "cover": "./assets/images/cooketh.png",
  "excerpt": "Short tagline shown on the card and hero.",
  "repo": "https://github.com/CookethOrg/Cooketh-Flow",
  "demo": "https://…",            // optional live link
  "watch": "https://youtu.be/…",  // optional video link
  "tech": ["Flutter", "Supabase"],// optional chips
  "body": "./projects/details/cooketh-flow.md" // optional long write-up
}
```

- The homepage **Projects** grid is generated from your existing cards and each
  card links to its launch page (filtering still works as before).
- To add a **detailed launch write-up**, create a Markdown file in
  `projects/details/` and point `"body"` at it. Leave `"body": ""` for a
  short page (hero + links only).
- Each project page has **Share** and its **own** comments + 👍/👎 reactions
  (Giscus, mapped per project — they never bleed across projects).

## Comments & reactions (Giscus)

Blog posts support threaded comments and 👍/👎 reactions via
[giscus](https://giscus.app) (GitHub Discussions — free, no backend). To turn it on:

1. Enable **Discussions** on the repo (Settings → Features → Discussions).
2. Install the **giscus app**: <https://github.com/apps/giscus>.
3. Go to <https://giscus.app>, enter `TeeWrath/teewrath.github.io`, pick a category
   (e.g. *Announcements*), and copy the generated `repoId` and `categoryId`.
4. Paste them into the `GISCUS` config block near the top of `post.html`.

Until configured, posts show a placeholder; the **Share** button works regardless.

## Editable content (`data/`)

The Experience page (professional experience, freelance & clients, testimonials,
community efforts, tools & tech) and the Talks/Sessions page are all rendered from
JSON files in `data/`, so you can edit them without touching any HTML:

- `data/experience.json` — professional experience, grouped by company/role
- `data/freelance.json` — freelance & client cards, the NDA note, and the CTA text
- `data/testimonials.json` — testimonial cards
- `data/community.json` — community efforts & positions of responsibility
- `data/tools-tech.json` — tools & tech chip groups
- `data/sessions.json` — talks / sessions list

Edit an entry, save, and refresh — `assets/js/content.js` fetches and renders these
on page load. (Projects and blog posts already live in `projects/projects.json` and
`blog/posts.json` respectively.)

## Résumé

The résumé isn't hosted on the site — **View Résumé** links straight out to the
Google Drive folder that holds it, so there's nothing to keep in sync here.

## Theming

Amber/gold on espresso. Dark/light is toggled with the button in the top-right and
remembered per visitor (`localStorage`). First visit follows the OS preference.

## License

MIT

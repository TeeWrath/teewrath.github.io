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

## Comments & reactions (Giscus)

Blog posts support threaded comments and 👍/👎 reactions via
[giscus](https://giscus.app) (GitHub Discussions — free, no backend). To turn it on:

1. Enable **Discussions** on the repo (Settings → Features → Discussions).
2. Install the **giscus app**: <https://github.com/apps/giscus>.
3. Go to <https://giscus.app>, enter `TeeWrath/teewrath.github.io`, pick a category
   (e.g. *Announcements*), and copy the generated `repoId` and `categoryId`.
4. Paste them into the `GISCUS` config block near the top of `post.html`.

Until configured, posts show a placeholder; the **Share** button works regardless.

## Résumé

Your résumé is a single Markdown file: `resume.md`. Edit it there — it powers both:

- the **View Résumé** dialog on the homepage, and
- the standalone, printable page `resume.html`.

Visitors can **Download PDF** (generated client-side on a clean light layout),
**Share** the link, or **Print**. No external resume host needed.

## Theming

Amber/gold on espresso. Dark/light is toggled with the button in the top-right and
remembered per visitor (`localStorage`). First visit follows the OS preference.

## License

MIT

# Event Mapper — SEO setup and operations

Everything in this document is already implemented in the codebase unless it sits
under **"What you still have to do"**. That section needs your Google account and
cannot be done from code.

---

## 1. Configuration

Two environment variables drive the whole SEO layer.

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `SITE_URL` | Strongly recommended | `https://event-mapper.vercel.app` | Base for every canonical tag, sitemap URL, OG tag and the `Sitemap:` line in `robots.txt`. Set it per environment. No trailing slash. |
| `GOOGLE_SITE_VERIFICATION` | Only during verification | *(empty)* | When set, renders `<meta name="google-site-verification">` on every page. |
| `NODE_ENV` | Yes, in production | *(unset)* | Must be `production` on the live site. It switches on the HTTPS redirect, HSTS, secure cookies and static asset caching. |

If `SITE_URL` is wrong, **every canonical tag on the site points at the wrong
domain** and Google will consolidate your pages onto that domain instead of yours.
It is the single most important value here.

---

## 2. What was changed

### The one that mattered most

`/` — the bare domain — returned a 404. Only `/listings` worked. A crawler that
hits the root of a site and gets "Page Not Found" has very little reason to look
further, and any backlink to the bare domain was landing on an error page.
`/` now returns a **301 to `/listings`**.

### Indexing and crawling

- **`robots.txt`** — served at `/robots.txt` by [`routes/seo.js`](../routes/seo.js).
  Allows everything except `?q=` search URLs, which are an unbounded crawl space
  with no unique content. It points at the sitemap.
  Note that private pages are *not* blocked here on purpose: a crawler has to be
  able to fetch a page to see its `noindex` tag. Blocking them in `robots.txt`
  is exactly what produces *"Indexed, though blocked by robots.txt"* warnings.
- **`sitemap.xml`** — served at `/sitemap.xml`, generated from the database on
  each request (cached one hour). Contains `/listings` plus every event page with
  a real `lastmod`. New events appear automatically; you never regenerate it.
- **No `noindex` tags existed to remove.** I searched the entire codebase and
  there were none — so that was not what was keeping you out of the index.
  I *added* `noindex, follow` to the pages that must never be indexed:
  `/login`, `/signup`, `/logout`, `/listings/new`, `/listings/:id/edit`,
  `/listings/dashboard` (a filtered duplicate of `/listings`) and all error
  pages. Indexable pages carry
  `index, follow, max-image-preview:large, max-snippet:-1`, which is what lets
  Google show a large image thumbnail next to your result.
- **Canonical tags** — absolute, self-referencing, on every page. Search result
  URLs (`/listings?q=music`) canonicalise to the clean `/listings`.

### Duplicate-URL cleanup

These all used to be separate, indexable URLs serving identical content:

- `http://` and `https://` → `http://` now 301s to `https://` in production.
- `/listings/` and `/listings` → trailing slashes 301 to the clean path.
- `/style.css` and `/css/style.css` → the app mounted `public/css`, `public/js`
  *and* `public/` as three overlapping static roots, so every asset had two URLs.
  Now there is one static mount.

### URL slugs

Event URLs were raw Mongo ObjectIds: `/listings/67a734ca7d9f9e63a30ad459`.
They are now readable: `/listings/github-workshop-0ad459`.

- The 6-character suffix is the tail of the ObjectId. It guarantees uniqueness
  without a database lookup, so two events called "Diwali Mela" never collide.
- **Old links keep working.** A raw ObjectId URL 301s to the slug. If you edit a
  title, the slug changes and the *old* slug still 301s to the new one, resolved
  via the `shortId` field. No link equity is lost.
- Existing events were backfilled with slugs automatically on first boot.
- Owner-only routes (`PUT`, `DELETE`, `/edit`, `/attend`) still use the immutable
  ObjectId, which is correct — those are not indexable URLs.

### Titles, descriptions, headings

- Every page has a unique `<title>` (kept under 60 characters so it is not
  truncated in results) and a unique `<meta name="description">` (truncated on a
  word boundary at ~155 characters). Event pages build both from the event's own
  title, category and location.
- **Exactly one `<h1>` per page**, verified across every route. Previously the
  listings page had *no* `h1` at all and the event page had three `h3`s and no
  `h1`.
- Heading order is now sequential: `h1` → `h2` (section) → `h3` (review author).
  The footer headings were `h6` purely for sizing; they are `h2` with a CSS class
  that keeps the same visual size.

### Structured data (schema markup)

Validated as parseable JSON-LD on every page type:

| Page | Schema |
| --- | --- |
| All pages | `WebSite` (with `SearchAction` for the sitelinks search box) + `Organization` |
| `/listings` | `BreadcrumbList` + `ItemList` of events |
| `/listings/:slug` | `Event` (date, place, geo coordinates, organizer, `Offer` in INR, `AggregateRating` when reviews exist) + `BreadcrumbList` |

`Event` schema is what makes your listings eligible for Google's event rich
results and the events carousel. Test individual URLs at
<https://search.google.com/test/rich-results> after deploying.

### Images

- **Every image now has descriptive alt text** built from the event title,
  category and location — not `alt="listing_image"`, which is what all of them
  said before.
- Cloudinary now serves `f_auto,q_auto` plus explicit dimensions. Measured on a
  real listing image: **197,835 bytes PNG → 17,612 bytes WebP, a 91% reduction**,
  with no change to how it looks.
- `width` and `height` attributes on every `<img>` so the browser reserves space
  before the image arrives — this is what fixes Cumulative Layout Shift.
- Below-the-fold images are `loading="lazy"`; the first three cards are
  `fetchpriority="high"` because one of them is the Largest Contentful Paint
  element.

### Core Web Vitals

- **Mapbox GL JS (~800 KB of JS + CSS) was loading on every single page.** It now
  loads only on event detail pages, the one place a map is rendered. This is the
  largest single performance change here.
- All scripts are `defer`red, so none of them block rendering.
- Font Awesome loads non-blocking (`media="print"` + `onload`), with a `<noscript>`
  fallback.
- Google Fonts narrowed from the full 200–800 variable range to the three weights
  actually used.
- `preconnect` to Cloudinary and the font hosts, issued before the images are
  requested.
- Static assets get a 7-day cache with ETag revalidation in production.
- The navbar's inline `<style>` block moved into `style.css` so it is cached once
  instead of re-sent in every HTML response.

### Mobile responsiveness

The real cause of the horizontal scrolling was two CSS rules:

```css
@media (max-width: 769px) {
  .show-body { min-width: 420px; }   /* wider than a 390px iPhone viewport */
  .container { max-width: 450px !important; }  /* squeezed tablets too */
}
```

Both are gone; Bootstrap's grid handles it. Also fixed:

- `#map { width: 80vh }` — that is `vh`, viewport *height*, on a width property.
- `col-6 offset-3` / `col-8 offset-2` (fixed at every breakpoint) → responsive
  `col-md-*` / `col-lg-*` variants.
- `.card-title, .card-text { display: inline !important }` was unscoped and
  collapsed every card on the site onto one line. Scoped to review cards.
- `.edit-btn { width: 4rem !important }` on mobile, which clipped button labels.
- `.navbar { height: 5rem }` clipped the expanded mobile menu.

### Broken links and broken features

- The footer's **"AI Connect", "Airbnb", "Event Mapper", "Soon!", "Shipping
  Rates"** links all pointed at `#!` and went nowhere. **"Airbnb Your Home"** was
  left over from a different project. Replaced with a real Explore/Account
  structure linking to the pages that exist.
- Facebook and Instagram icons had `href=""`, which reloads the current page.
  Removed, since there are no accounts for them.
- **The navbar search box did nothing** — no `action`, no `name` on the input. It
  now submits to `/listings?q=` and filters server-side on title, location,
  category and country. (This also makes the `SearchAction` schema honest.)
- **The listings page threw a JavaScript error on every load**: an inline script
  called `addEventListener` on `#flexSwitchCheckDefault`, an element that does not
  exist anywhere in the project. Removed along with the orphaned "+18% GST" text
  it was meant to toggle.
- `views/listings/show.ejs` called `layout()` three times and had a stray
  `</form>` after `</html>`.
- A missing event used to 302-redirect to `/listings`. That is a **soft 404** —
  Google keeps the dead URL indexed and flags the site. It now returns a real 404.
- `store.on("error", () => console.log(err))` referenced an undefined `err`, so
  any session store error crashed the process instead of logging.
- `controllers/users.js` called `next(err)` inside `signup` without `next` being a
  parameter.
- Form `<label for="...">` attributes pointed at `id`s that did not exist on any
  input, so clicking a label did nothing. `<lable>` typos on the login and signup
  forms meant those fields had no label at all.
- `new.ejs` rendered the bare word "required" as page text.

### Internal linking

- Breadcrumb navigation on event pages.
- A "Keep exploring" block on every event page linking to the index, dashboard and
  create form.
- Dashboard event cards now link to the events (they were dead text before).
- Footer links to all four real sections plus the sitemap.
- Contextual links in body copy and empty states.
- Auth links carry `rel="nofollow"` so crawl budget goes to event pages.

### HTTPS

- `app.set("trust proxy", 1)` so `req.protocol` is correct behind Vercel's proxy.
- `http://` → `https://` 301 in production.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- Session cookies are `secure` and `sameSite: lax` in production.

### Other assets

- `og-image.png` (1200×630), `favicon.ico`, `favicon.svg` and
  `apple-touch-icon.png` were generated and are in `public/`. `/favicon.ico`
  previously 404'd on every page load.
- Added `npm start` to `package.json` and corrected `main` from the nonexistent
  `index.js` to `app.js`.

---

## 3. What you still have to do

### a. Set `SITE_URL` in production

On Vercel: Project → Settings → Environment Variables →
`SITE_URL = https://event-mapper.vercel.app` (or your custom domain), then
redeploy. Also confirm `NODE_ENV=production` is set.

### b. Verify Google Search Console

1. Go to <https://search.google.com/search-console> and add a property.
2. Choose **URL prefix** and enter `https://event-mapper.vercel.app`.
3. Pick the **HTML tag** method. Copy the `content="..."` value only.
4. Set it as the `GOOGLE_SITE_VERIFICATION` environment variable and redeploy.
5. Click Verify.
6. Once verified, go to **Sitemaps** and submit `sitemap.xml`.
7. Use **URL Inspection** on `https://event-mapper.vercel.app/listings` and click
   **Request Indexing**. Do the same for two or three event pages.

Do the same at <https://www.bing.com/webmasters> — Bing feeds DuckDuckGo and
takes minutes to set up.

### c. Expect a delay

Indexing is not instant. A new or previously-404ing site typically takes **1–4
weeks** to appear for anything other than its exact brand name. Check Search
Console → Pages weekly for what has been indexed and what has been excluded, and
why.

### d. Restrict your Mapbox token

`MAP_TOKEN` is a public `pk.*` token and is visible in the page source. That is
how Mapbox is designed to work, but you should add a URL restriction to it in the
Mapbox dashboard so it only works from your domain.

### e. Two things worth knowing about Vercel

- **Socket.io will not work on Vercel's serverless functions.** They do not
  support long-lived WebSocket connections. The live attendee counter will silently fall
  back to only updating on page reload. If you need it working, deploy to Render,
  Railway or Fly.io instead — all three run a persistent Node process and the code
  needs no changes.
- There is no `vercel.json` in the repo, so the deployment is configured through
  the dashboard. I did not add one, because guessing at it could break a working
  deploy.

---

## 4. Backlink strategy

Backlinks are the slowest-moving part of SEO and the one most easily wasted. The
ordering below is deliberate: everything in Tier 1 is free, takes under an hour
total, and is appropriate for a project site. Nothing here involves buying links
or link exchanges — those carry a real risk of a manual penalty and are not worth
it at any site size.

### Before you chase a single link

A link to a page that 404s is wasted, and until this work shipped your bare domain
*was* that page. Confirm `https://event-mapper.vercel.app` returns 200 (after the
301 to `/listings`) before you start pointing links at it.

### Tier 1 — Do this week (free, ~1 hour, high confidence)

These are links you control. They are not powerful individually, but they
establish the site as real and give crawlers paths in.

1. **Your GitHub repository.** Put the live URL in the repo's *Website* field
   (top-right of the repo page, not just the README) and in the README. Add
   `event-management`, `nodejs`, `express`, `mongodb` as repo topics.
2. **Your GitHub profile README and bio.**
3. **LinkedIn.** Featured section, plus the Projects section with the URL. Write
   one post about what you built and link it — you already have the audience.
4. **X/Twitter.** Pinned post and profile link.
5. **Dev.to / Hashnode.** One honest build writeup: the architecture, the Mapbox
   geocoding, the real-time attendee counter. Link the live site in the body, not
   only the bio. These are `dofollow` and get indexed quickly.
6. **Your personal portfolio site**, if you have one.

### Tier 2 — Next two weeks (free, moderate effort, good quality)

7. **Peerlist** — strong for Indian developer projects, and the profile pages
   rank well.
8. **Product Hunt.** Even a modest launch produces a permanent, indexed listing.
   Launch Tuesday–Thursday, prepare the OG image and a 30-second demo clip.
9. **Reddit** — r/webdev's Showoff Saturday, r/SideProject, r/india if the events
   are India-focused. These are `nofollow`, so they pass no direct ranking signal,
   but they produce traffic and the *secondary* links that follow are what count.
   Read each subreddit's self-promotion rules first; getting banned costs more
   than the link is worth.
10. **Indie Hackers**, **Hacker News Show HN** (Saturday morning US time gets the
    least competition).
11. **Awesome lists on GitHub.** Search `awesome event` / `awesome mern` and open
    a PR where the list genuinely covers what you built.

### Tier 3 — Ongoing (highest value, slowest)

12. **Make the events themselves the link magnet.** This is the only strategy
    that compounds. Every event page is a unique URL with `Event` schema on it. If
    real organisers list real events, *they* will link to their own event page
    from their Instagram, their college notice board, their WhatsApp groups. Ten
    organisers each sharing their own page beats any directory submission.
    Add a visible "Share this event" button to the event page — this is the single
    highest-leverage feature you could build next for SEO.
13. **Local and college ecosystems.** Raipur tech communities, nearby college
    fests and coding club event pages. These sites are small but topically and
    geographically relevant, which is worth more per link than a generic
    directory.
14. **Write one genuinely useful guide** that is not about your product — "How to
    organise a college tech fest in India", say — and link the tool naturally from
    within it. Guides earn links; landing pages do not.

### What not to do

- **Do not buy backlinks**, use PBNs, or sign up for "500 backlinks for $5"
  services. The links are worthless and Google's link spam systems now neutralise
  or penalise them.
- **Do not mass-submit to directories.** Generic directory links have been
  discounted for a decade. A handful of relevant ones (a startup directory, an
  events-tools list) is fine; 200 is a spam signal.
- **Do not exchange links** in "I'll link you if you link me" threads. It is a
  recognised pattern.
- **Do not worry about `nofollow` vs `dofollow`.** Google treats `nofollow` as a
  hint now, and traffic from a `nofollow` link is still traffic.

### How to measure it

Check monthly, not weekly — nothing here moves faster than that:

- **Search Console → Links → External links.** This is the authoritative list of
  what Google has actually found.
- **Search Console → Performance.** Watch impressions before clicks; impressions
  rising means you are being ranked, even if not yet highly enough to be clicked.
- `site:event-mapper.vercel.app` in Google tells you roughly how many pages are
  indexed. Compare it against the URL count in your sitemap.
- Ahrefs Webmaster Tools is free for a site you have verified in Search Console
  and gives a more complete backlink picture than Search Console alone.

### A realistic expectation

A new project site with ten to twenty good Tier 1 and Tier 2 links will rank for
its brand name ("event mapper") within a month or two, and for long-tail phrases
("event listing site raipur") within three to six. It will not rank for
competitive head terms like "event management platform" — those belong to sites
with thousands of links and years of history, and pursuing them is not a good use
of your time. The event pages themselves, each targeting a specific event name in
a specific city, are where the realistic traffic is.

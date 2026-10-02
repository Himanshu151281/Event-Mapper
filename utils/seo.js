// Central SEO configuration and helpers.
// Every canonical URL, sitemap entry and social tag is derived from SITE_URL,
// so a deploy to a new domain only needs that one environment variable changed.

const SITE_URL = (process.env.SITE_URL || "https://event-mapper.vercel.app")
  .trim()
  .replace(/\/+$/, "");

const SITE_NAME = "Event Mapper";
const TWITTER_HANDLE = "@x_himanshukumar";
const LOCALE = "en_IN";

const DEFAULT_TITLE = "Event Mapper | Discover and Host Local Events";
const DEFAULT_DESCRIPTION =
  "Find events happening near you on a live map, see who is attending in real time, and host your own event in minutes. Free to browse, free to list.";

const OG_IMAGE = `${SITE_URL}/og-image.png`;
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

// Paths that must never reach the index: auth screens, owner-only forms and
// error pages. They carry no search value and would split crawl budget.
const NOINDEX_PREFIXES = [
  "/login",
  "/signup",
  "/logout",
  "/listings/new",
  "/listings/dashboard",
];

function absoluteUrl(pathname = "/") {
  if (!pathname) return SITE_URL;
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return `${SITE_URL}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}

function isNoindexPath(pathname = "/") {
  const clean = pathname.split("?")[0];
  if (clean.endsWith("/edit")) return true;
  return NOINDEX_PREFIXES.some((p) => clean === p || clean.startsWith(`${p}/`));
}

// Collapse whitespace and cut on a word boundary so descriptions never get
// truncated by Google mid-word.
function truncate(text, max = 155) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

// Page titles stay under ~60 characters so they are not truncated in results.
function buildTitle(pageTitle) {
  if (!pageTitle) return DEFAULT_TITLE;
  const suffix = ` | ${SITE_NAME}`;
  const room = 60 - suffix.length;
  const head = pageTitle.length > room ? truncate(pageTitle, room) : pageTitle;
  return `${head}${suffix}`;
}

// Cloudinary delivers a smaller, modern-format image when we ask for it.
// f_auto picks AVIF/WebP per browser, q_auto picks the lowest visually
// lossless quality, and c_fill + w/h stops the browser downloading desktop
// pixels for a phone.
function optimizedImage(url, { width = 800, height, crop = "fill" } = {}) {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("/upload/")) return url;
  const parts = ["f_auto", "q_auto", `w_${width}`];
  if (height) {
    parts.push(`h_${height}`, `c_${crop}`);
  }
  return url.replace("/upload/", `/upload/${parts.join(",")}/`);
}

// JSON-LD must be injected raw (unescaped) so it stays valid JSON. Escaping
// `<` prevents a listing title containing "</script>" from breaking out.
function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function buildSeo({
  title,
  description,
  path = "/",
  image,
  imageAlt,
  type = "website",
  noindex,
  schema,
} = {}) {
  const canonicalPath = String(path || "/").split("?")[0];
  return {
    title: buildTitle(title),
    description: truncate(description || DEFAULT_DESCRIPTION),
    canonical: absoluteUrl(canonicalPath),
    // Listing images are requested from Cloudinary at exactly 1200x630
    // (c_fill), so the declared dimensions hold for both cases.
    image: image ? absoluteUrl(image) : OG_IMAGE,
    imageAlt: imageAlt || `${SITE_NAME} — discover and host local events`,
    imageWidth: OG_IMAGE_WIDTH,
    imageHeight: OG_IMAGE_HEIGHT,
    type,
    noindex: noindex === undefined ? isNoindexPath(canonicalPath) : !!noindex,
    schema: schema || null,
  };
}

// Site-wide structured data. Emitted on every page so Google can resolve the
// publisher and wire up the sitelinks search box.
function siteSchema() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/listings?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: OG_IMAGE,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
      },
      sameAs: [
        "https://x.com/x_himanshukumar",
        "https://www.linkedin.com/in/himanshu-kumar151281/",
        "https://github.com/Himanshu151281",
      ],
    },
  ];
}

function breadcrumbSchema(crumbs) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

module.exports = {
  SITE_URL,
  SITE_NAME,
  TWITTER_HANDLE,
  LOCALE,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  OG_IMAGE,
  absoluteUrl,
  isNoindexPath,
  truncate,
  buildTitle,
  optimizedImage,
  jsonLd,
  buildSeo,
  siteSchema,
  breadcrumbSchema,
};

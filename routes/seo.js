const express = require("express");
const Listing = require("../models/listing.js");
const wrapAsync = require("../utils/wrapAsync.js");
const { buildSlug } = require("../utils/slugify.js");
const { SITE_URL, absoluteUrl } = require("../utils/seo.js");

const router = express.Router();

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const isoDate = (date) => (date instanceof Date ? date : new Date()).toISOString().split("T")[0];

router.get("/robots.txt", (req, res) => {
  // Auth screens, owner forms and the dashboard are deliberately NOT
  // disallowed here: they carry a noindex meta tag, and a crawler has to be
  // able to fetch a page to see that tag. Blocking them in robots.txt is what
  // produces "Indexed, though blocked by robots.txt" in Search Console.
  // Only search result URLs, which are an unbounded crawl space with no
  // unique content, are blocked outright.
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    "# Search result pages: unbounded URL space, no unique content.",
    "Disallow: /listings?q=",
    "Disallow: /*?q=",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");

  res.type("text/plain").set("Cache-Control", "public, max-age=86400").send(body);
});

router.get(
  "/sitemap.xml",
  wrapAsync(async (req, res) => {
    const listings = await Listing.find({})
      .select("slug _id title updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    const urls = [
      { loc: absoluteUrl("/listings"), lastmod: isoDate(listings[0] && listings[0].updatedAt), priority: "1.0" },
    ];

    for (const listing of listings) {
      const slug = listing.slug || buildSlug(listing.title, listing._id);
      urls.push({
        loc: absoluteUrl(`/listings/${slug}`),
        lastmod: isoDate(listing.updatedAt),
        priority: "0.8",
      });
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map(
        (u) =>
          `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`
      ),
      "</urlset>",
      "",
    ].join("\n");

    res
      .type("application/xml")
      .set("Cache-Control", "public, max-age=3600")
      .send(xml);
  })
);

module.exports = router;

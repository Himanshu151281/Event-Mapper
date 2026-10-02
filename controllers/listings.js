const Listing = require("../models/listing");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const ExpressError = require("../utils/ExpressError.js");
const { buildSlug, isObjectId } = require("../utils/slugify.js");
const {
  SITE_NAME,
  buildSeo,
  breadcrumbSchema,
  optimizedImage,
  truncate,
  absoluteUrl,
} = require("../utils/seo.js");

const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

const listingPath = (listing) => `/listings/${listing.slug || listing._id}`;

// Escape user input before it reaches a RegExp so a title search for "c++"
// cannot throw or turn into a catastrophic pattern.
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports.index = async (req, res) => {
  const q = (req.query.q || "").trim();

  let filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter = { $or: [{ title: rx }, { location: rx }, { category: rx }, { country: rx }] };
  }

  const allListings = await Listing.find(filter).sort({ date: 1 });

  const seo = buildSeo({
    title: q ? `Events matching “${q}”` : "Browse Events Near You",
    description: q
      ? `Events on ${SITE_NAME} matching “${q}”. Browse dates, locations and prices, then reserve your spot.`
      : `Browse ${allListings.length} events you can attend — concerts, meetups, workshops and festivals — each pinned on a live map with real-time attendee counts.`,
    // Search results canonicalise to the clean listings URL so ?q= variants
    // never compete with it in the index.
    path: "/listings",
    noindex: false,
    schema: [
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Events", path: "/listings" },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Events on Event Mapper",
        numberOfItems: allListings.length,
        itemListElement: allListings.slice(0, 50).map((listing, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: absoluteUrl(listingPath(listing)),
          name: listing.title,
        })),
      },
    ],
  });

  res.render("listings/index.ejs", { allListings, q, seo });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs", {
    seo: buildSeo({
      title: "Host an Event",
      description: "Create and publish your event on Event Mapper in a few minutes.",
      path: "/listings/new",
    }),
  });
};

module.exports.createListing = async (req, res, next) => {
  let response = await geocodingClient
    .forwardGeocode({
      query: req.body.listing.location,
      limit: 1,
    })
    .send();

  if (!response.body.features.length) {
    req.flash("error", "We could not find that location. Please try a more specific place.");
    return res.redirect("/listings/new");
  }

  if (!req.file) {
    req.flash("error", "Please upload an image for your event.");
    return res.redirect("/listings/new");
  }

  let url = req.file.path;
  let filename = req.file.filename;

  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;
  newListing.image = { url, filename };
  newListing.geometry = response.body.features[0].geometry;
  let savedListing = await newListing.save();
  req.flash("success", "New Listing Created!");
  res.redirect(listingPath(savedListing));
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing Not Exist!");
    return res.redirect("/listings");
  }
  const originalImageUrl = optimizedImage(listing.image.url, { width: 250 });
  res.render("listings/edit.ejs", {
    listing,
    originalImageUrl,
    seo: buildSeo({
      title: `Edit ${listing.title}`,
      description: "Edit your event details on Event Mapper.",
      path: `/listings/${id}/edit`,
    }),
  });
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing Not Exist!");
    return res.redirect("/listings");
  }

  Object.assign(listing, req.body.listing);

  if (typeof req.file !== "undefined") {
    listing.image = { url: req.file.path, filename: req.file.filename };
  }

  // Re-geocode only when the location actually changed, so an unrelated edit
  // does not burn a Mapbox request or wipe good coordinates.
  if (listing.isModified("location")) {
    const response = await geocodingClient
      .forwardGeocode({ query: listing.location, limit: 1 })
      .send();
    if (response.body.features.length) {
      listing.geometry = response.body.features[0].geometry;
    }
  }

  await listing.save();
  req.flash("success", "Listing Updated!");
  res.redirect(listingPath(listing));
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Listing Deleted!");
  res.redirect("/listings");
};

// Resolves a public event URL. Accepts the current slug, an outdated slug
// (title was edited) and a legacy raw ObjectId URL — the last two are
// permanently redirected so link equity lands on one canonical URL.
module.exports.showListing = async (req, res) => {
  const { slug } = req.params;

  let listing = await Listing.findOne({ slug })
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");

  if (!listing) {
    const suffix = (slug.match(/-([0-9a-f]{6})$/i) || [])[1];
    const lookup = isObjectId(slug)
      ? { _id: slug }
      : suffix
      ? { shortId: suffix.toLowerCase() }
      : null;

    const match = lookup ? await Listing.findOne(lookup) : null;
    // A real 404 rather than a redirect to /listings. Redirecting a missing
    // page to a working one is a soft 404: Google keeps the dead URL in the
    // index and flags the site for it.
    if (!match) {
      throw new ExpressError(404, "That event does not exist or has been removed.");
    }

    // Backfill a slug for events created before slugs existed.
    if (!match.slug) {
      match.slug = buildSlug(match.title, match._id);
      match.shortId = String(match._id).slice(-6);
      await match.save();
    }
    return res.redirect(301, listingPath(match));
  }

  const ratings = listing.reviews.map((r) => r.rating).filter((n) => n > 0);
  const averageRating = ratings.length
    ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
    : null;

  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: listing.title,
    description: truncate(listing.description, 300),
    startDate: listing.date ? listing.date.toISOString() : undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: absoluteUrl(listingPath(listing)),
    image: [optimizedImage(listing.image && listing.image.url, { width: 1200 })].filter(Boolean),
    location: {
      "@type": "Place",
      name: listing.location,
      address: {
        "@type": "PostalAddress",
        addressLocality: listing.location,
        addressCountry: listing.country,
      },
      geo:
        listing.geometry && listing.geometry.coordinates
          ? {
              "@type": "GeoCoordinates",
              latitude: listing.geometry.coordinates[1],
              longitude: listing.geometry.coordinates[0],
            }
          : undefined,
    },
    organizer: listing.owner
      ? { "@type": "Person", name: listing.owner.username }
      : undefined,
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: absoluteUrl(listingPath(listing)),
    },
  };

  if (averageRating) {
    eventSchema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: averageRating,
      reviewCount: ratings.length,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const seo = buildSeo({
    title: listing.title,
    description:
      listing.description ||
      `${listing.title} — a ${listing.category} event in ${listing.location}, ${listing.country}. See details and attend on Event Mapper.`,
    path: listingPath(listing),
    type: "article",
    image: optimizedImage(listing.image && listing.image.url, { width: 1200, height: 630 }),
    imageAlt: `${listing.title} in ${listing.location}`,
    noindex: false,
    schema: [
      eventSchema,
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Events", path: "/listings" },
        { name: listing.title, path: listingPath(listing) },
      ]),
    ],
  });

  res.render("listings/show.ejs", { listing, seo, averageRating, needsMap: true });
};

module.exports.listingPath = listingPath;

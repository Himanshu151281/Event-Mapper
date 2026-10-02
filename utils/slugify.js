// Turns an event title into a clean, readable URL slug.
// A short suffix taken from the document id guarantees uniqueness without a
// database round-trip, so two events called "Diwali Mela" never collide.

function slugifyText(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

function buildSlug(title, id) {
  const suffix = String(id || "").slice(-6);
  const base = slugifyText(title);
  if (!base) return suffix || "event";
  return suffix ? `${base}-${suffix}` : base;
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function isObjectId(value) {
  return OBJECT_ID.test(String(value || ""));
}

module.exports = { slugifyText, buildSlug, isObjectId };

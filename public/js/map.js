// Renders the event location map. Guarded so a listing saved without
// coordinates degrades to an empty map container instead of a page-wide
// JavaScript error.
(() => {
  const container = document.getElementById("map");
  if (!container || typeof mapboxgl === "undefined") return;
  if (typeof listing === "undefined" || !listing.geometry || !listing.geometry.coordinates) return;

  mapboxgl.accessToken = mapToken;

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v12",
    center: listing.geometry.coordinates,
    zoom: 9,
  });

  new mapboxgl.Marker({ color: "red" })
    .setLngLat(listing.geometry.coordinates)
    .setPopup(
      new mapboxgl.Popup({ offset: 25 }).setText(
        `${listing.title} — exact location will be provided after booking`
      )
    )
    .addTo(map);
})();

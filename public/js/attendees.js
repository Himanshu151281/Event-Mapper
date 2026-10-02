// Live attendee count for a single event page.
(() => {
  const counter = document.getElementById("attendees-count");
  if (!counter || typeof io !== "function" || !window.__listingId) return;

  const socket = io();
  socket.on("updateAttendees", (data) => {
    if (data && data.id === window.__listingId) {
      counter.textContent = data.attendees;
    }
  });
})();

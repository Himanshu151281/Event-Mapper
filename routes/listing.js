const express = require("express");
const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../models/listing.js");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");

const router = express.Router();
const upload = multer({ storage });

module.exports = (io) => {
  router
    .route("/")
    .get(wrapAsync(listingController.index))
    .post(
      isLoggedIn,
      upload.single("listing[image]"),
      validateListing,
      wrapAsync(listingController.createListing)
    );

  router.route("/new").get(isLoggedIn, listingController.renderNewForm);

  router.get(
    "/dashboard",
    wrapAsync(async (req, res) => {
      const { category, startDate, endDate } = req.query;
      let filter = {};

      if (category) {
        filter.category = category;
      }
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) {
          filter.date.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.date.$lte = new Date(endDate);
        }
      }

      const listings = await Listing.find(filter);
      res.render("listings/dashboard.ejs", { listings });
    })
  );

  router
    .route("/:id/edit")
    .get(isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm));

  router.post(
    "/:id/attend",
    isLoggedIn,
    wrapAsync(async (req, res) => {
      const { id } = req.params;
      const listing = await Listing.findById(id);
      listing.attendees += 1;
      await listing.save();
      io.emit("updateAttendees", { id, attendees: listing.attendees });
      res.redirect(`/listings/${id}`);
    })
  );

  router
    .route("/:id")
    .put(
      isLoggedIn,
      isOwner,
      upload.single("listing[image]"),
      validateListing,
      wrapAsync(listingController.updateListing)
    )
    .delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing))
    .get(wrapAsync(listingController.showListing));

  return router;
};
const Listing = require("../models/listing");
const Review = require("../models/review");
const ExpressError = require("../utils/ExpressError.js");

// Redirect straight to the canonical slug URL instead of the ObjectId URL,
// which would only 301 to the same place a moment later.
const listingPath = (listing) => `/listings/${listing.slug || listing._id}`;

module.exports.createReview = async (req, res) => {
  let listing = await Listing.findById(req.params.id);
  if (!listing) {
    throw new ExpressError(404, "That event does not exist or has been removed.");
  }
  let newReview = new Review(req.body.review);
  newReview.author = req.user._id;
  listing.reviews.push(newReview);
  await newReview.save();
  await listing.save();
  req.flash("success", "New Review Created!");
  res.redirect(listingPath(listing));
};

module.exports.destroyReview = async (req, res) => {
  let { id, reviewId } = req.params;
  const listing = await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  if (!listing) {
    throw new ExpressError(404, "That event does not exist or has been removed.");
  }
  req.flash("success", "Review Deleted!");
  res.redirect(listingPath(listing));
};

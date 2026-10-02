const mongoose = require("mongoose");
const Review = require("./review.js");
const { buildSlug } = require("../utils/slugify.js");

const Schema = mongoose.Schema;

const listingSchema = new Schema(
  {
  title: {
    type: String,
    required: true,
  },
  // Human-readable URL segment, e.g. "diwali-night-market-4f1a2b".
  slug: {
    type: String,
    index: true,
    unique: true,
    sparse: true,
  },
  // Last 6 characters of _id. Lets an outdated slug (the title was edited)
  // still resolve to the right event so old links 301 instead of 404.
  shortId: {
    type: String,
    index: true,
  },
  description: String,
  image: {
    url: String,
    filename: String,
  },
  price: Number,
  location: String,
  country: String,
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  geometry: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  category: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  attendees: {
    type: Number,
    default: 0,
  },
  },
  { timestamps: true }
);

// Keep the slug in step with the title on every save.
listingSchema.pre("save", function (next) {
  this.shortId = String(this._id).slice(-6);
  if (this.isModified("title") || !this.slug) {
    this.slug = buildSlug(this.title, this._id);
  }
  next();
});

listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;

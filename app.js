if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStatergy = require("passport-local");
const User = require("./models/user.js");
const seoRouter = require("./routes/seo.js");
const {
  buildSeo,
  siteSchema,
  optimizedImage,
  jsonLd,
  SITE_URL,
  SITE_NAME,
  TWITTER_HANDLE,
  LOCALE,
} = require("./utils/seo.js");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// Required so req.protocol and secure cookies reflect the original request
// when the app runs behind a platform proxy (Vercel, Render, nginx).
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = socketIo(server);

const dbUrl = process.env.ATLASDB_URL;

async function main() {
  await mongoose.connect(dbUrl);
}
// One-off, idempotent backfill: events created before slugs existed get one
// so they appear in the sitemap with a readable URL.
async function backfillSlugs() {
  const Listing = require("./models/listing.js");
  const pending = await Listing.find({
    $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }],
  });
  for (const listing of pending) {
    await listing.save(); // pre-save hook builds slug + shortId
  }
  if (pending.length) {
    console.log(`backfilled slugs for ${pending.length} listing(s)`);
  }
}

main()
  .then(async () => {
    console.log("connected to the database");
    try {
      await backfillSlugs();
    } catch (err) {
      console.error("slug backfill failed", err);
    }
  })
  .catch((err) => {
    console.error(err);
  });

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);

// Force HTTPS in production. Search engines treat http:// and https:// as two
// different sites, so an un-redirected http version splits ranking signals.
app.use((req, res, next) => {
  if (isProduction && req.protocol !== "https") {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Strip trailing slashes (except on "/") so /listings/ and /listings are not
// two indexable URLs for one page.
app.use((req, res, next) => {
  if (req.method === "GET" && req.path.length > 1 && req.path.endsWith("/")) {
    const query = req.originalUrl.slice(req.path.length);
    return res.redirect(301, req.path.replace(/\/+$/, "") + query);
  }
  next();
});

// One static mount (the previous three overlapping mounts meant every asset
// was reachable at two URLs). Hashed-free assets still get a long cache with
// revalidation, which is a direct LCP win on repeat visits.
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: isProduction ? "7d" : 0,
    etag: true,
  })
);

const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => {
  console.log("ERROR in MONGO SESSION STORE", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
  },
};

app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStatergy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;

  // SEO helpers every template can rely on, plus a safe default head so a
  // view that forgets to pass `seo` still renders valid, non-duplicate tags.
  res.locals.seo = buildSeo({ path: req.path });
  res.locals.siteSchema = siteSchema();
  res.locals.jsonLd = jsonLd;
  res.locals.optimizedImage = optimizedImage;
  res.locals.site = { url: SITE_URL, name: SITE_NAME, twitter: TWITTER_HANDLE, locale: LOCALE };
  res.locals.googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION || "";
  next();
});

// The bare domain used to 404, which is the single worst signal a site can
// send a crawler. It now permanently redirects to the events index.
app.get("/", (req, res) => res.redirect(301, "/listings"));

app.use("/", seoRouter);
app.use("/listings", listingRouter(io));
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something Went Wrong" } = err;
  if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }
  if (statusCode >= 500) {
    console.error(err);
  }
  res.status(statusCode).render("error.ejs", {
    message,
    statusCode,
    // Error pages must never be indexed, whatever path produced them.
    seo: buildSeo({
      title: statusCode === 404 ? "Page Not Found" : "Something Went Wrong",
      description: "The page you were looking for is not available on Event Mapper.",
      path: req.path,
      noindex: true,
    }),
  });
});

io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// On Vercel the platform invokes the exported handler itself, so binding a
// port there would fail. Only listen when running as a normal long-lived
// process (local dev, Render, a container).
if (!process.env.VERCEL) {
  const port = process.env.PORT || 8080;
  server.listen(port, () => {
    console.log(`server is listening on port ${port}`);
  });
}

module.exports = app;
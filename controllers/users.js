const User = require("../models/user");
const { buildSeo } = require("../utils/seo.js");

module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs", {
    seo: buildSeo({
      title: "Create Your Account",
      description: "Sign up for Event Mapper to attend events, leave reviews and host your own.",
      path: "/signup",
    }),
  });
};

module.exports.signup = async (req, res, next) => {
  try {
    let { username, email, password } = req.body;
    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);
    req.login(registeredUser, (err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", "Welcome To Event Mapper!");
      res.redirect("/listings");
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs", {
    seo: buildSeo({
      title: "Log In",
      description: "Log in to Event Mapper to manage the events you host and attend.",
      path: "/login",
    }),
  });
};

module.exports.login = async (req, res) => {
  req.flash("success", "Welcome back to Event Mapper!");
  let redirectUrl = res.locals.redirectUrl || "/listings";
  delete req.session.redirectUrl;
  res.redirect(redirectUrl);
};

module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "You are logged out!");
    res.redirect("/listings");
  });
};

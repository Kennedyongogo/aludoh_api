const rateLimit = require("express-rate-limit");

const publicSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many submissions. Please try again in a few minutes.",
  },
});

// Looser limit for status lookups, still tight enough to stop guessing references
const publicLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many lookups. Please try again in a few minutes.",
  },
});

module.exports = { publicSubmitLimiter, publicLookupLimiter };

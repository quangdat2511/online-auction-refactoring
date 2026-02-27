/**
 * Centralized application configuration.
 * All magic numbers and hardcoded constants are defined here.
 * Change once → takes effect everywhere.
 */

// --- Pagination ---
export const PAGINATION = {
  PRODUCTS_PER_PAGE: 3,       // Browse (category list, search results, watchlist)
  COMMENTS_PER_PAGE: 2,       // Product detail — comment section
  TOP_PRODUCTS_LIMIT: 5,      // Homepage — Top ending / Top bids / Top price
};

// --- Authentication ---
export const AUTH = {
  BCRYPT_SALT_ROUNDS: 10,           // Cost factor for bcrypt password hashing
  OTP_EXPIRY_MS: 15 * 60 * 1000,   // OTP validity window: 15 minutes
};

// --- File Upload ---
export const UPLOAD = {
  IMAGE_MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB — payment/shipping proof images
};

// --- Session ---
export const SESSION = {
  REFRESH_INTERVAL_MS: 60_000, // Re-sync user data from DB every 60 seconds
};

// --- Auction ---
export const AUCTION = {
  END_NOTIFIER_INTERVAL_SECONDS: 30, // How often the end-notifier cron job runs
};

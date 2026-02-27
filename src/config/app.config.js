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

// --- Order Status (DB-level, stored in orders.status column) ---
// Adding a new order status only requires adding an entry here + a matching
// entry in STATUS_TIMESTAMPS in order.model.js; no switch/if chains to touch.
export const ORDER_STATUS = {
  PENDING_PAYMENT:   'pending_payment',
  PAYMENT_SUBMITTED: 'payment_submitted',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  SHIPPED:           'shipped',
  DELIVERED:         'delivered',
  COMPLETED:         'completed',
  CANCELLED:         'cancelled',
};

// --- Product Status (app-level, computed by determineProductStatus) ---
export const PRODUCT_STATUS = {
  ACTIVE:    'ACTIVE',
  PENDING:   'PENDING',
  SOLD:      'SOLD',
  CANCELLED: 'CANCELLED',
  EXPIRED:   'EXPIRED',
};

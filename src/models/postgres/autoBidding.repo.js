import db from '../../utils/db.js';

// ── Internal Query Helper ────────────────────────────────
/** Returns a subquery that counts bids for the current product row. */
const bidCountRaw = () =>
  db.raw(`(SELECT COUNT(*) FROM bidding_history WHERE bidding_history.product_id = products.id) AS bid_count`);
// ─────────────────────────────────────────────────────────

export async function upsertAutoBid(productId, bidderId, maxPrice, trx = null) {
  return (trx || db).raw(`
    INSERT INTO auto_bidding (product_id, bidder_id, max_price)
    VALUES (?, ?, ?)
    ON CONFLICT (product_id, bidder_id)
    DO UPDATE SET 
      max_price = EXCLUDED.max_price,
      created_at = NOW()
    RETURNING *
  `, [productId, bidderId, maxPrice]);
}

export async function getAutoBid(productId, bidderId, trx = null) {
  return (trx || db)('auto_bidding')
    .where('product_id', productId)
    .where('bidder_id', bidderId)
    .first();
}

export async function getAllAutoBids(productId, trx = null) {
  return (trx || db)('auto_bidding')
    .where('product_id', productId)
    .orderBy('max_price', 'desc');
}

export async function deleteAutoBid(productId, bidderId, trx = null) {
  return (trx || db)('auto_bidding')
    .where('product_id', productId)
    .where('bidder_id', bidderId)
    .del();
}

export async function getBiddingProductsByBidderId(bidderId) {
  return db('auto_bidding')
    .join('products', 'auto_bidding.product_id', 'products.id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('auto_bidding.bidder_id', bidderId)
    .where('products.end_at', '>', new Date())
    .whereNull('products.closed_at')
    .select(
      'products.*',
      'categories.name as category_name',
      'auto_bidding.max_price as my_max_bid',
      db.raw(`
        CASE 
          WHEN products.highest_bidder_id = ? THEN true 
          ELSE false 
        END AS is_winning
      `, [bidderId]),
      bidCountRaw()
    )
    .orderBy('products.end_at', 'asc');
}

export async function getWonAuctionsByBidderId(bidderId) {
  return db('products')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .leftJoin('users as seller', 'products.seller_id', 'seller.id')
    .where('products.highest_bidder_id', bidderId)
    .where(function() {
      this.where(function() {
        this.where(function() {
          this.where('products.end_at', '<=', new Date())
            .orWhereNotNull('products.closed_at');
        }).whereNull('products.is_sold');
      })
      .orWhere('products.is_sold', true)
      .orWhere('products.is_sold', false);
    })
    .select(
      'products.*',
      'categories.name as category_name',
      'seller.fullname as seller_name',
      'seller.email as seller_email',
      db.raw(`
        CASE
          WHEN products.is_sold IS TRUE THEN 'Sold'
          WHEN products.is_sold IS FALSE THEN 'Cancelled'
          WHEN (products.end_at <= NOW() OR products.closed_at IS NOT NULL) AND products.is_sold IS NULL THEN 'Pending'
        END AS status
      `),
      bidCountRaw()
    )
    .orderBy('products.end_at', 'desc');
}

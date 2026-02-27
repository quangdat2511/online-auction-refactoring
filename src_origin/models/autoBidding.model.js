import db from '../utils/db.js';

/**
 * Thêm hoặc cập nhật auto bidding record cho một bidder
 * @param {number} productId - ID sản phẩm
 * @param {number} bidderId - ID người đặt giá
 * @param {number} maxPrice - Giá tối đa người này sẵn sàng trả
 * @returns {Promise} Kết quả upsert
 */
export async function upsertAutoBid(productId, bidderId, maxPrice) {
  // Use PostgreSQL's ON CONFLICT to handle upsert
  return db.raw(`
    INSERT INTO auto_bidding (product_id, bidder_id, max_price)
    VALUES (?, ?, ?)
    ON CONFLICT (product_id, bidder_id)
    DO UPDATE SET 
      max_price = EXCLUDED.max_price,
      created_at = NOW()
    RETURNING *
  `, [productId, bidderId, maxPrice]);
}

/**
 * Lấy auto bid record của một bidder cho sản phẩm
 * @param {number} productId - ID sản phẩm
 * @param {number} bidderId - ID người đặt giá
 * @returns {Promise<Object>} Auto bid record
 */
export async function getAutoBid(productId, bidderId) {
  return db('auto_bidding')
    .where('product_id', productId)
    .where('bidder_id', bidderId)
    .first();
}

/**
 * Lấy tất cả auto bids cho một sản phẩm
 * @param {number} productId - ID sản phẩm
 * @returns {Promise<Array>} Danh sách auto bids
 */
export async function getAllAutoBids(productId) {
  return db('auto_bidding')
    .where('product_id', productId)
    .orderBy('max_price', 'desc');
}

/**
 * Xóa auto bid của một bidder
 * @param {number} productId - ID sản phẩm
 * @param {number} bidderId - ID người đặt giá
 * @returns {Promise} Kết quả xóa
 */
export async function deleteAutoBid(productId, bidderId) {
  return db('auto_bidding')
    .where('product_id', productId)
    .where('bidder_id', bidderId)
    .del();
}

/**
 * Lấy tất cả sản phẩm mà bidder đang tham gia đấu giá
 * @param {number} bidderId - ID người đặt giá
 * @returns {Promise<Array>} Danh sách sản phẩm
 */
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
      db.raw(`
        (
          SELECT COUNT(*) 
          FROM bidding_history 
          WHERE bidding_history.product_id = products.id
        ) AS bid_count
      `)
    )
    .orderBy('products.end_at', 'asc');
}

/**
 * Lấy tất cả sản phẩm mà bidder đã thắng (pending, sold, cancelled)
 * @param {number} bidderId - ID người đặt giá
 * @returns {Promise<Array>} Danh sách sản phẩm
 */
export async function getWonAuctionsByBidderId(bidderId) {
  return db('products')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .leftJoin('users as seller', 'products.seller_id', 'seller.id')
    .where('products.highest_bidder_id', bidderId)
    .where(function() {
      this.where(function() {
        // Pending: (end_at <= NOW OR closed_at) AND is_sold IS NULL
        this.where(function() {
          this.where('products.end_at', '<=', new Date())
            .orWhereNotNull('products.closed_at');
        }).whereNull('products.is_sold');
      })
      .orWhere('products.is_sold', true)   // Sold
      .orWhere('products.is_sold', false); // Cancelled
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
      db.raw(`
        (
          SELECT COUNT(*) 
          FROM bidding_history 
          WHERE bidding_history.product_id = products.id
        ) AS bid_count
      `)
    )
    .orderBy('products.end_at', 'desc');
}

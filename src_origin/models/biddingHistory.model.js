import db from '../utils/db.js';

/**
 * Thêm một lượt bid mới vào hệ thống
 * @param {number} productId - ID sản phẩm
 * @param {number} bidderId - ID người đặt giá
 * @param {number} currentPrice - Giá hiện tại của sản phẩm sau khi update
 * @returns {Promise} Kết quả insert
 */
export async function createBid(productId, bidderId, currentPrice) {
  return db('bidding_history').insert({
    product_id: productId,
    bidder_id: bidderId,
    current_price: currentPrice
  }).returning('*');
}

/**
 * Lấy lịch sử đấu giá của một sản phẩm
 * @param {number} productId - ID sản phẩm
 * @returns {Promise<Array>} Danh sách lịch sử bid
 */
export async function getBiddingHistory(productId) {
  return db('bidding_history')
    .join('users', 'bidding_history.bidder_id', 'users.id')
    .where('bidding_history.product_id', productId)
    .select(
      'bidding_history.id',
      'bidding_history.product_id',
      'bidding_history.bidder_id',
      'bidding_history.current_price',
      'bidding_history.created_at',
      'bidding_history.is_buy_now',
      db.raw(`mask_name_alternating(users.fullname) AS bidder_name`)
    )
    .orderBy('bidding_history.created_at', 'desc');
}

/**
 * Lấy bid cao nhất của một sản phẩm
 * @param {number} productId - ID sản phẩm
 * @returns {Promise<Object>} Bid cao nhất
 */
export async function getHighestBid(productId) {
  return db('bidding_history')
    .where('product_id', productId)
    .orderBy('current_price', 'desc')
    .first();
}

/**
 * Kiểm tra xem user đã bid cho sản phẩm này chưa
 * @param {number} productId - ID sản phẩm
 * @param {number} bidderId - ID người đặt giá
 * @returns {Promise<boolean>} True nếu đã bid
 */
export async function hasUserBidOnProduct(productId, bidderId) {
  const result = await db('bidding_history')
    .where('product_id', productId)
    .where('bidder_id', bidderId)
    .first();
  return !!result;
}

/**
 * Lấy danh sách unique bidders của một sản phẩm (với email)
 * @param {number} productId - ID sản phẩm
 * @returns {Promise<Array>} Danh sách bidders với email
 */
export async function getUniqueBidders(productId) {
  return db('bidding_history')
    .join('users', 'bidding_history.bidder_id', 'users.id')
    .where('bidding_history.product_id', productId)
    .distinct('users.id', 'users.email', 'users.fullname')
    .select('users.id', 'users.email', 'users.fullname');
}
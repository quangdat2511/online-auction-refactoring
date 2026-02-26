import db from '../utils/db.js';

/**
 * Check if a bidder is rejected from a product
 * @param {number} productId - Product ID
 * @param {number} bidderId - Bidder ID
 * @returns {Promise<boolean>} True if bidder is rejected
 */
export async function isRejected(productId, bidderId) {
  const result = await db('rejected_bidders')
    .where('product_id', productId)
    .where('bidder_id', bidderId)
    .first();
  
  return !!result;
}

/**
 * Add a bidder to the rejected list for a product
 * @param {number} productId - Product ID
 * @param {number} bidderId - Bidder ID
 * @param {number} sellerId - Seller ID who rejected
 * @returns {Promise} Insert result
 */
export async function rejectBidder(productId, bidderId, sellerId) {
  return db('rejected_bidders').insert({
    product_id: productId,
    bidder_id: bidderId,
    seller_id: sellerId
  }).returning('*');
}

/**
 * Get all rejected bidders for a product
 * @param {number} productId - Product ID
 * @returns {Promise<Array>} List of rejected bidders
 */
export async function getRejectedBidders(productId) {
  return db('rejected_bidders')
    .join('users', 'rejected_bidders.bidder_id', 'users.id')
    .where('rejected_bidders.product_id', productId)
    .select(
      'rejected_bidders.id',
      'rejected_bidders.product_id',
      'rejected_bidders.bidder_id',
      'rejected_bidders.rejected_at',
      'users.fullname as bidder_name',
      'users.email as bidder_email'
    )
    .orderBy('rejected_bidders.rejected_at', 'desc');
}

/**
 * Remove a bidder from rejected list (unreject)
 * @param {number} productId - Product ID
 * @param {number} bidderId - Bidder ID
 * @returns {Promise} Delete result
 */
export async function unrejectBidder(productId, bidderId) {
  return db('rejected_bidders')
    .where('product_id', productId)
    .where('bidder_id', bidderId)
    .del();
}

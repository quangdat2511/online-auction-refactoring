import db from '../../utils/db.js';

export async function createBid(productId, bidderId, currentPrice, trx = null, options = {}) {
  const { isBuyNow = false } = options;
  return (trx || db)('bidding_history').insert({
    product_id: productId,
    bidder_id: bidderId,
    current_price: currentPrice,
    ...(isBuyNow && { is_buy_now: true }),
  }).returning('*');
}

export async function deleteByProductAndBidder(productId, bidderId, trx = null) {
  return (trx || db)('bidding_history')
    .where('product_id', productId)
    .where('bidder_id', bidderId)
    .del();
}

export async function getLastByProduct(productId, trx = null) {
  return (trx || db)('bidding_history')
    .where('product_id', productId)
    .orderBy('created_at', 'desc')
    .first();
}

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

export async function getHighestBid(productId) {
  return db('bidding_history')
    .where('product_id', productId)
    .orderBy('current_price', 'desc')
    .first();
}

export async function hasUserBidOnProduct(productId, bidderId) {
  const result = await db('bidding_history')
    .where('product_id', productId)
    .where('bidder_id', bidderId)
    .first();
  return !!result;
}

export async function getUniqueBidders(productId) {
  return db('bidding_history')
    .join('users', 'bidding_history.bidder_id', 'users.id')
    .where('bidding_history.product_id', productId)
    .distinct('users.id', 'users.email', 'users.fullname')
    .select('users.id', 'users.email', 'users.fullname');
}

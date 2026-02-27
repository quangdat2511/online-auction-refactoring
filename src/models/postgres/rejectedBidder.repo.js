import db from '../../utils/db.js';

export async function isRejected(productId, bidderId, trx = null) {
  const result = await (trx || db)('rejected_bidders')
    .where('product_id', productId)
    .where('bidder_id', bidderId)
    .first();
  return !!result;
}

export async function rejectBidder(productId, bidderId, sellerId, trx = null) {
  return (trx || db)('rejected_bidders')
    .insert({ product_id: productId, bidder_id: bidderId, seller_id: sellerId })
    .onConflict(['product_id', 'bidder_id'])
    .ignore();
}

export async function getRejectedBidders(productId) {
  return db('rejected_bidders')
    .join('users', 'rejected_bidders.bidder_id', 'users.id')
    .where('rejected_bidders.product_id', productId)
    .select(
      'rejected_bidders.id', 'rejected_bidders.product_id', 'rejected_bidders.bidder_id',
      'rejected_bidders.rejected_at', 'users.fullname as bidder_name', 'users.email as bidder_email'
    )
    .orderBy('rejected_bidders.rejected_at', 'desc');
}

export async function unrejectBidder(productId, bidderId) {
  return db('rejected_bidders').where('product_id', productId).where('bidder_id', bidderId).del();
}

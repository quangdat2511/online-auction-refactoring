import { userModel, reviewModel } from '../../models/index.js';

async function getRatingStats(userId) {
  const ratingData = await reviewModel.calculateRatingPoint(userId);
  const rating_point = ratingData ? ratingData.rating_point : 0;
  const reviews = await reviewModel.getReviewsByUserId(userId);
  const totalReviews = reviews.length;
  const positiveReviews = reviews.filter(r => r.rating === 1).length;
  const negativeReviews = reviews.filter(r => r.rating === -1).length;
  return { rating_point, reviews, totalReviews, positiveReviews, negativeReviews };
}

export async function getSellerRatingStats(sellerId) {
  const seller = await userModel.findById(sellerId);
  if (!seller) return null;
  const stats = await getRatingStats(sellerId);
  return { sellerName: seller.fullname, ...stats };
}

export async function getBidderRatingStats(bidderId) {
  const bidder = await userModel.findById(bidderId);
  if (!bidder) return null;
  const maskedName = bidder.fullname
    ? bidder.fullname.split('').map((char, index) => (index % 2 === 0 ? char : '*')).join('')
    : '';
  const stats = await getRatingStats(bidderId);
  return { bidderName: maskedName, ...stats };
}

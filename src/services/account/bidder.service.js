import * as watchlistModel from '../../models/watchlist.model.js';
import * as reviewModel from '../../models/review.model.js';
import * as autoBiddingModel from '../../models/autoBidding.model.js';

export async function getRatingStats(userId) {
  const ratingData = await reviewModel.calculateRatingPoint(userId);
  const rating_point = ratingData ? ratingData.rating_point : 0;
  const reviews = await reviewModel.getReviewsByUserId(userId);
  const totalReviews = reviews.length;
  const positiveReviews = reviews.filter(r => r.rating === 1).length;
  const negativeReviews = reviews.filter(r => r.rating === -1).length;
  return { rating_point, reviews, totalReviews, positiveReviews, negativeReviews };
}

export async function getWatchlistPage(userId, page = 1, limit = 3) {
  const offset = (page - 1) * limit;
  const watchlistProducts = await watchlistModel.searchPageByUserId(userId, limit, offset);
  const total = await watchlistModel.countByUserId(userId);
  const totalCount = Number(total.count);
  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) { from = 0; to = 0; }
  return { products: watchlistProducts, totalCount, from, to, currentPage: page, totalPages: nPages };
}

export async function getBiddingProducts(userId) {
  return autoBiddingModel.getBiddingProductsByBidderId(userId);
}

export async function getWonAuctionsWithRatings(userId) {
  const wonAuctions = await autoBiddingModel.getWonAuctionsByBidderId(userId);
  for (let product of wonAuctions) {
    const review = await reviewModel.findByReviewerAndProduct(userId, product.id);
    if (review && review.rating !== 0) {
      product.has_rated_seller = true;
      product.seller_rating = review.rating === 1 ? 'positive' : 'negative';
      product.seller_rating_comment = review.comment;
    } else {
      product.has_rated_seller = false;
    }
  }
  return wonAuctions;
}

export async function rateSeller({ reviewerId, productId, sellerId, rating, comment }) {
  const ratingValue = rating === 'positive' ? 1 : -1;
  const existingReview = await reviewModel.findByReviewerAndProduct(reviewerId, productId);
  if (existingReview) {
    await reviewModel.updateByReviewerAndProduct(reviewerId, productId, {
      rating: ratingValue,
      comment: comment || null,
    });
  } else {
    await reviewModel.create({
      reviewer_id: reviewerId,
      reviewed_user_id: sellerId,
      product_id: productId,
      rating: ratingValue,
      comment: comment || null,
    });
  }
}

export async function updateSellerRating({ reviewerId, productId, rating, comment }) {
  const ratingValue = rating === 'positive' ? 1 : -1;
  await reviewModel.updateByReviewerAndProduct(reviewerId, productId, {
    rating: ratingValue,
    comment: comment || null,
  });
}

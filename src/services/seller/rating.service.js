import { reviewModel } from '../../models/index.js';

export async function rateBidder({ sellerId, productId, highest_bidder_id, rating, comment }) {
  if (!highest_bidder_id) {
    throw new Error('No bidder to rate');
  }
  const ratingValue = rating === 'positive' ? 1 : -1;

  const existingReview = await reviewModel.findByReviewerAndProduct(
    sellerId,
    productId
  );

  if (existingReview) {
    await reviewModel.updateByReviewerAndProduct(sellerId, productId, {
      rating: ratingValue,
      comment: comment || '',
    });
  } else {
    const reviewData = {
      reviewer_id: sellerId,
      reviewee_id: highest_bidder_id,
      product_id: productId,
      rating: ratingValue,
      comment: comment || '',
    };
    await reviewModel.createReview(reviewData);
  }
}

export async function updateBidderRating({ sellerId, productId, highest_bidder_id, rating, comment }) {
  if (!highest_bidder_id) {
    throw new Error('No bidder to rate');
  }
  const ratingValue = rating === 'positive' ? 1 : -1;
  await reviewModel.updateReview(
    sellerId,
    highest_bidder_id,
    productId,
    {
      rating: ratingValue,
      comment: comment || '',
    }
  );
}

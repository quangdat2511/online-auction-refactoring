import { productModel, reviewModel, biddingHistoryModel, productCommentModel, productDescUpdateModel, rejectedBidderModel } from '../../models/index.js';
import { PAGINATION, PRODUCT_STATUS } from '../../config/app.config.js';

export function determineProductStatus(product) {
  const now = new Date();
  const endDate = new Date(product.end_at);

  if (product.is_sold === true) return PRODUCT_STATUS.SOLD;
  if (product.is_sold === false) return PRODUCT_STATUS.CANCELLED;
  if ((endDate <= now || product.closed_at) && product.highest_bidder_id) return PRODUCT_STATUS.PENDING;
  if (endDate <= now && !product.highest_bidder_id) return PRODUCT_STATUS.EXPIRED;
  return PRODUCT_STATUS.ACTIVE;
}

export function isSellerOrBidder(product, userId) {
  return product.seller_id === userId || product.highest_bidder_id === userId;
}

export async function getProductDetails(productId, userId, commentPage = 1) {
  const product = await productModel.findByProductId2(productId, userId);

  if (!product) return null;

  // Auto-close auction if time expired and not yet closed
  const now = new Date();
  const endDate = new Date(product.end_at);
  if (endDate <= now && !product.closed_at && product.is_sold === null) {
    await productModel.updateProduct(productId, { closed_at: endDate });
    product.closed_at = endDate;
  }

  const productStatus = determineProductStatus(product);

  // Check authorization for non-ACTIVE products
  if (productStatus !== PRODUCT_STATUS.ACTIVE) {
    if (!userId) return { unauthorized: true };
    if (!isSellerOrBidder(product, userId)) return { unauthorized: true };
  }

  const commentsPerPage = PAGINATION.COMMENTS_PER_PAGE;
  const offset = (commentPage - 1) * commentsPerPage;

  const [descriptionUpdates, biddingHistory, comments, totalComments, relatedProducts] = await Promise.all([
    productDescUpdateModel.findByProductId(productId),
    biddingHistoryModel.getBiddingHistory(productId),
    productCommentModel.getCommentsByProductId(productId, commentsPerPage, offset),
    productCommentModel.countCommentsByProductId(productId),
    productModel.findRelatedProducts(productId),
  ]);

  // Load rejected bidders only for seller
  let rejectedBidders = [];
  if (userId && product.seller_id === userId) {
    rejectedBidders = await rejectedBidderModel.getRejectedBidders(productId);
  }

  // Batch-load replies to avoid N+1
  if (comments.length > 0) {
    const commentIds = comments.map(c => c.id);
    const allReplies = await productCommentModel.getRepliesByCommentIds(commentIds);
    const repliesMap = new Map();
    for (const reply of allReplies) {
      if (!repliesMap.has(reply.parent_id)) repliesMap.set(reply.parent_id, []);
      repliesMap.get(reply.parent_id).push(reply);
    }
    for (const comment of comments) {
      comment.replies = repliesMap.get(comment.id) || [];
    }
  }

  const totalPages = Math.ceil(totalComments / commentsPerPage);

  // Ratings
  const [sellerRatingObject, sellerReviews] = await Promise.all([
    reviewModel.calculateRatingPoint(product.seller_id),
    reviewModel.getReviewsByUserId(product.seller_id),
  ]);

  let bidderRatingObject = { rating_point: null };
  let bidderReviews = [];
  if (product.highest_bidder_id) {
    [bidderRatingObject, bidderReviews] = await Promise.all([
      reviewModel.calculateRatingPoint(product.highest_bidder_id),
      reviewModel.getReviewsByUserId(product.highest_bidder_id),
    ]);
  }

  let showPaymentButton = false;
  if (userId && productStatus === 'PENDING') {
    showPaymentButton = (product.seller_id === userId || product.highest_bidder_id === userId);
  }

  return {
    product,
    productStatus,
    descriptionUpdates,
    biddingHistory,
    rejectedBidders,
    comments,
    related_products: relatedProducts,
    seller_rating_point: sellerRatingObject.rating_point,
    seller_has_reviews: sellerReviews.length > 0,
    bidder_rating_point: bidderRatingObject.rating_point,
    bidder_has_reviews: bidderReviews.length > 0,
    commentPage,
    totalPages,
    totalComments,
    showPaymentButton,
  };
}

export async function getBiddingHistoryPage(productId) {
  const product = await productModel.findByProductId2(productId, null);
  if (!product) return null;
  const biddingHistory = await biddingHistoryModel.getBiddingHistory(productId);
  return { product, biddingHistory };
}

export async function getBidHistoryJSON(productId) {
  return biddingHistoryModel.getBiddingHistory(productId);
}

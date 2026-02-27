import express from 'express';
import * as watchlistModel from '../../models/watchlist.model.js';
import * as reviewModel from '../../models/review.model.js';
import * as autoBiddingModel from '../../models/autoBidding.model.js';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';

const router = express.Router();

router.get('/ratings', isAuthenticated, async (req, res) => {
  const currentUserId = req.session.authUser.id;
  
  // // Get rating point
  const ratingData = await reviewModel.calculateRatingPoint(currentUserId);
  const rating_point = ratingData ? ratingData.rating_point : 0;
  // // Get all reviews (model already excludes rating=0)
  const reviews = await reviewModel.getReviewsByUserId(currentUserId);
  
  // // Calculate statistics
  const totalReviews = reviews.length;
  const positiveReviews = reviews.filter(r => r.rating === 1).length;
  const negativeReviews = reviews.filter(r => r.rating === -1).length;
  
  res.render('vwAccount/rating', { 
    activeSection: 'ratings',
    rating_point,
    reviews,
    totalReviews,
    positiveReviews,
    negativeReviews
  });
});

router.get('/watchlist', isAuthenticated ,async (req, res) => {
  const limit = 3;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  // Implementation for watchlist route
  const currentUserId = req.session.authUser.id;
  const watchlistProducts = await watchlistModel.searchPageByUserId(currentUserId, limit, offset);
  const total = await watchlistModel.countByUserId(currentUserId);
  const totalCount = Number(total.count);
  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) { from = 0; to = 0; }
  res.render('vwAccount/watchlist', {
    products: watchlistProducts,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages: nPages,
  });
});

// Bidding Products - Sản phẩm đang tham gia đấu giá
router.get('/bidding', isAuthenticated, async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const biddingProducts = await autoBiddingModel.getBiddingProductsByBidderId(currentUserId);
  
  res.render('vwAccount/bidding-products', {
    activeSection: 'bidding',
    products: biddingProducts
  });
});

// Won Auctions - Sản phẩm đã thắng (pending, sold, cancelled)
router.get('/auctions', isAuthenticated, async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const wonAuctions = await autoBiddingModel.getWonAuctionsByBidderId(currentUserId);
  
  // Check if user has rated seller for each product
  for (let product of wonAuctions) {
    const review = await reviewModel.findByReviewerAndProduct(currentUserId, product.id);
    // Only show rating if it's not 0 (actual rating, not skip)
    if (review && review.rating !== 0) {
      product.has_rated_seller = true;
      product.seller_rating = review.rating === 1 ? 'positive' : 'negative';
      product.seller_rating_comment = review.comment;
    } else {
      product.has_rated_seller = false;
    }
  }
  
  res.render('vwAccount/won-auctions', {
    activeSection: 'auctions',
    products: wonAuctions
  });
});

// Rate Seller - POST
router.post('/won-auctions/:productId/rate-seller', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const productId = req.params.productId;
    const { seller_id, rating, comment } = req.body;
    
    // Validate rating
    const ratingValue = rating === 'positive' ? 1 : -1;
    
    // Check if already rated
    const existingReview = await reviewModel.findByReviewerAndProduct(currentUserId, productId);
    if (existingReview) {
      // Update existing review instead of creating new
      await reviewModel.updateByReviewerAndProduct(currentUserId, productId, {
        rating: ratingValue,
        comment: comment || null
      });
    } else {
      // Create new review
      await reviewModel.create({
        reviewer_id: currentUserId,
        reviewed_user_id: seller_id,
        product_id: productId,
        rating: ratingValue,
        comment: comment || null
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error rating seller:', error);
    res.json({ success: false, message: 'Failed to submit rating.' });
  }
});

// Rate Seller - PUT (Edit)
router.put('/won-auctions/:productId/rate-seller', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const productId = req.params.productId;
    const { rating, comment } = req.body;
    
    const ratingValue = rating === 'positive' ? 1 : -1;
    
    // Update review
    await reviewModel.updateByReviewerAndProduct(currentUserId, productId, {
      rating: ratingValue,
      comment: comment || null
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating rating:', error);
    res.json({ success: false, message: 'Failed to update rating.' });
  }
});

export default router;

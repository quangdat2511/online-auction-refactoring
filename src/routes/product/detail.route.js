import express from 'express';
import * as productModel from '../../models/product.model.js';
import * as reviewModel from '../../models/review.model.js';
import * as biddingHistoryModel from '../../models/biddingHistory.model.js';
import * as productCommentModel from '../../models/productComment.model.js';
import * as productDescUpdateModel from '../../models/productDescriptionUpdate.model.js';
import * as rejectedBidderModel from '../../models/rejectedBidder.model.js';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';

const router = express.Router();

router.get('/detail', async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const productId = req.query.id;
  const product = await productModel.findByProductId2(productId, userId);
  const related_products = await productModel.findRelatedProducts(productId);
  
  // Kiểm tra nếu không tìm thấy sản phẩm
  if (!product) {
    return res.status(404).render('404', { message: 'Product not found' });
  }
  console.log('Product details:', product);
  // Determine product status
  const now = new Date();
  const endDate = new Date(product.end_at);
  let productStatus = 'ACTIVE';
  
  // Auto-close auction if time expired and not yet closed
  if (endDate <= now && !product.closed_at && product.is_sold === null) {
    // Update closed_at to mark auction end time
    await productModel.updateProduct(productId, { closed_at: endDate });
    product.closed_at = endDate; // Update local object
  }
  
  if (product.is_sold === true) {
    productStatus = 'SOLD';
  } else if (product.is_sold === false) {
    productStatus = 'CANCELLED';
  } else if ((endDate <= now || product.closed_at) && product.highest_bidder_id) {
    productStatus = 'PENDING';
  } else if (endDate <= now && !product.highest_bidder_id) {
    productStatus = 'EXPIRED';
  } else if (endDate > now && !product.closed_at) {
    productStatus = 'ACTIVE';
  }

  // Authorization check: Non-ACTIVE products can only be viewed by seller or highest bidder
  if (productStatus !== 'ACTIVE') {
    if (!userId) {
      // User not logged in, cannot view non-active products
      return res.status(403).render('403', { message: 'You do not have permission to view this product' });
    }
    
    const isSeller = product.seller_id === userId;
    const isHighestBidder = product.highest_bidder_id === userId;
    
    if (!isSeller && !isHighestBidder) {
      return res.status(403).render('403', { message: 'You do not have permission to view this product' });
    }
  }

  // Pagination for comments
  const commentPage = parseInt(req.query.commentPage) || 1;
  const commentsPerPage = 2; // 2 comments per page
  const offset = (commentPage - 1) * commentsPerPage;

  // Load description updates, bidding history, and comments in parallel
  const [descriptionUpdates, biddingHistory, comments, totalComments] = await Promise.all([
    productDescUpdateModel.findByProductId(productId),
    biddingHistoryModel.getBiddingHistory(productId),
    productCommentModel.getCommentsByProductId(productId, commentsPerPage, offset),
    productCommentModel.countCommentsByProductId(productId)
  ]);

  // Load rejected bidders (only for seller)
  let rejectedBidders = [];
  if (req.session.authUser && product.seller_id === req.session.authUser.id) {
    rejectedBidders = await rejectedBidderModel.getRejectedBidders(productId);
  }
  
  // Load replies for all comments in one batch to avoid N+1 query problem
  if (comments.length > 0) {
    const commentIds = comments.map(c => c.id);
    const allReplies = await productCommentModel.getRepliesByCommentIds(commentIds);
    
    // Group replies by parent comment id
    const repliesMap = new Map();
    for (const reply of allReplies) {
      if (!repliesMap.has(reply.parent_id)) {
        repliesMap.set(reply.parent_id, []);
      }
      repliesMap.get(reply.parent_id).push(reply);
    }
    
    // Attach replies to their parent comments
    for (const comment of comments) {
      comment.replies = repliesMap.get(comment.id) || [];
    }
  }
  
  // Calculate total pages
  const totalPages = Math.ceil(totalComments / commentsPerPage);
  
  // Get flash messages from session
  const success_message = req.session.success_message;
  const error_message = req.session.error_message;
  delete req.session.success_message;
  delete req.session.error_message;

  // Get seller rating
  const sellerRatingObject = await reviewModel.calculateRatingPoint(product.seller_id);
  const sellerReviews = await reviewModel.getReviewsByUserId(product.seller_id);
  
  // Get bidder rating (if exists)
  let bidderRatingObject = { rating_point: null };
  let bidderReviews = [];
  if (product.highest_bidder_id) {
    bidderRatingObject = await reviewModel.calculateRatingPoint(product.highest_bidder_id);
    bidderReviews = await reviewModel.getReviewsByUserId(product.highest_bidder_id);
  }
  
  // Check if should show payment button (for seller or highest bidder when status is PENDING)
  let showPaymentButton = false;
  if (req.session.authUser && productStatus === 'PENDING') {
    const userId = req.session.authUser.id;
    showPaymentButton = (product.seller_id === userId || product.highest_bidder_id === userId);
  }
  
  res.render('vwProduct/details', { 
    product,
    productStatus, // Pass status to view
    authUser: req.session.authUser, // Pass authUser for checking highest_bidder_id
    descriptionUpdates,
    biddingHistory,
    rejectedBidders,
    comments,
    success_message,
    error_message,
    related_products,
    seller_rating_point: sellerRatingObject.rating_point,
    seller_has_reviews: sellerReviews.length > 0,
    bidder_rating_point: bidderRatingObject.rating_point,
    bidder_has_reviews: bidderReviews.length > 0,
    commentPage,
    totalPages,
    totalComments,
    showPaymentButton
  });
});

// ROUTE: BIDDING HISTORY PAGE (Requires Authentication)
router.get('/bidding-history', isAuthenticated, async (req, res) => {
  const productId = req.query.id;
  
  if (!productId) {
    return res.redirect('/');
  }

  try {
    // Get product information
    const product = await productModel.findByProductId2(productId, null);
    
    if (!product) {
      return res.status(404).render('404', { message: 'Product not found' });
    }

    // Load bidding history
    const biddingHistory = await biddingHistoryModel.getBiddingHistory(productId);
    
    res.render('vwProduct/biddingHistory', { 
      product,
      biddingHistory
    });
  } catch (error) {
    console.error('Error loading bidding history:', error);
    res.status(500).render('500', { message: 'Unable to load bidding history' });
  }
});

// ROUTE 4: GET BIDDING HISTORY
router.get('/bid-history/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const history = await biddingHistoryModel.getBiddingHistory(productId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Get bid history error:', error);
    res.status(500).json({ success: false, message: 'Unable to load bidding history' });
  }
  const result = await productModel.findByProductId(productId);
  const relatedProducts = await productModel.findRelatedProducts(productId);
  const product = {
    thumbnail: result[0].thumbnail,
    sub_images: result.reduce((acc, curr) => {
      if (curr.img_link) {
        acc.push(curr.img_link);
      }
      return acc;
    }, []),
    id: result[0].id,
    name: result[0].name,
    starting_price: result[0].starting_price,
    current_price: result[0].current_price,
    seller_id: result[0].seller_id,
    seller_fullname: result[0].seller_name,
    seller_rating: result[0].seller_rating_plus / (result[0].seller_rating_plus + result[0].seller_rating_minus),
    seller_member_since: new Date(result[0].seller_created_at).getFullYear(),
    buy_now_price: result[0].buy_now_price,
    seller_id: result[0].seller_id,
    hightest_bidder_id: result[0].highest_bidder_id,
    bidder_name: result[0].bidder_name,
    category_name: result[0].category_name,
    bid_count: result[0].bid_count,
    created_at: result[0].created_at,
    end_at: result[0].end_at,
    description: result[0].description,
    related_products: relatedProducts
  }
  res.render('vwProduct/details', { product });
});

export default router;

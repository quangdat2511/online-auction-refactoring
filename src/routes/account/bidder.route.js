import express from 'express';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';
import * as bidderService from '../../services/account/bidder.service.js';

const router = express.Router();

router.get('/ratings', isAuthenticated, async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const stats = await bidderService.getRatingStats(currentUserId);
  res.render('vwAccount/rating', {
    activeSection: 'ratings',
    ...stats,
  });
});

router.get('/watchlist', isAuthenticated, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const currentUserId = req.session.authUser.id;
  const data = await bidderService.getWatchlistPage(currentUserId, page);
  res.render('vwAccount/watchlist', data);
});

// Bidding Products - Sản phẩm đang tham gia đấu giá
router.get('/bidding', isAuthenticated, async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const products = await bidderService.getBiddingProducts(currentUserId);
  res.render('vwAccount/bidding-products', {
    activeSection: 'bidding',
    products,
  });
});

// Won Auctions - Sản phẩm đã thắng (pending, sold, cancelled)
router.get('/auctions', isAuthenticated, async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const products = await bidderService.getWonAuctionsWithRatings(currentUserId);
  res.render('vwAccount/won-auctions', {
    activeSection: 'auctions',
    products,
  });
});

// Rate Seller - POST
router.post('/won-auctions/:productId/rate-seller', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const productId = req.params.productId;
    const { seller_id, rating, comment } = req.body;
    await bidderService.rateSeller({ reviewerId: currentUserId, productId, sellerId: seller_id, rating, comment });
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
    await bidderService.updateSellerRating({ reviewerId: currentUserId, productId, rating, comment });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating rating:', error);
    res.json({ success: false, message: 'Failed to update rating.' });
  }
});

export default router;

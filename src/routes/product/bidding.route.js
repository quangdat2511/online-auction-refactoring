import express from 'express';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';
import * as biddingService from '../../services/product/bidding.service.js';

const router = express.Router();

// ROUTE 1: THÊM VÀO WATCHLIST (POST)
router.post('/watchlist', isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;

  await biddingService.addToWatchlist(userId, productId);

  const retUrl = req.headers.referer || '/';
  res.redirect(retUrl);
});

// ROUTE 2: XÓA KHỎI WATCHLIST (DELETE)
router.delete('/watchlist', isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;

  await biddingService.removeFromWatchlist(userId, productId);

  const retUrl = req.headers.referer || '/';
  res.redirect(retUrl);
});

// ROUTE 3: ĐẶT GIÁ (POST) - Server-side rendering with automatic bidding
router.post('/bid', isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = parseInt(req.body.productId);
  const bidAmount = parseFloat(req.body.bidAmount.replace(/,/g, ''));

  try {
    const productUrl = `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;
    const result = await biddingService.placeBid(userId, productId, bidAmount, productUrl);

    req.session.success_message = biddingService.buildBidSuccessMessage(result);
    res.redirect(`/products/detail?id=${productId}`);
  } catch (error) {
    console.error('Bid error:', error);
    req.session.error_message = error.message || 'An error occurred while placing bid. Please try again.';
    res.redirect(`/products/detail?id=${productId}`);
  }
});

// ROUTE: BUY NOW (POST) - Bidder directly purchases product at buy now price
router.post('/buy-now', isAuthenticated, async (req, res) => {
  const { productId } = req.body;
  const userId = req.session.authUser.id;

  try {
    await biddingService.buyNow(userId, productId);

    res.json({
      success: true,
      message: 'Congratulations! You have successfully purchased the product at Buy Now price. Please proceed to payment.',
      redirectUrl: `/products/complete-order?id=${productId}`
    });
  } catch (error) {
    console.error('Buy Now error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to purchase product'
    });
  }
});

export default router;

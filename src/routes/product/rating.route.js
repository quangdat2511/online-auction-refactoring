import express from 'express';
import * as ratingService from '../../services/product/rating.service.js';

const router = express.Router();

// ROUTE: Seller Ratings Page
router.get('/seller/:sellerId/ratings', async (req, res) => {
  try {
    const sellerId = parseInt(req.params.sellerId);
    if (!sellerId) return res.redirect('/');

    const data = await ratingService.getSellerRatingStats(sellerId);
    if (!data) return res.redirect('/');

    res.render('vwProduct/seller-ratings', data);
  } catch (error) {
    console.error('Error loading seller ratings page:', error);
    res.redirect('/');
  }
});

// ROUTE: Bidder Ratings Page
router.get('/bidder/:bidderId/ratings', async (req, res) => {
  try {
    const bidderId = parseInt(req.params.bidderId);
    if (!bidderId) return res.redirect('/');

    const data = await ratingService.getBidderRatingStats(bidderId);
    if (!data) return res.redirect('/');

    res.render('vwProduct/bidder-ratings', data);
  } catch (error) {
    console.error('Error loading bidder ratings page:', error);
    res.redirect('/');
  }
});

export default router;

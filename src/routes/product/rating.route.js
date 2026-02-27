import express from 'express';
import * as userModel from '../../models/user.model.js';
import * as reviewModel from '../../models/review.model.js';

const router = express.Router();

// ROUTE: Seller Ratings Page
router.get('/seller/:sellerId/ratings', async (req, res) => {
  try {
    const sellerId = parseInt(req.params.sellerId);
    
    if (!sellerId) {
      return res.redirect('/');
    }
    
    // Get seller info
    const seller = await userModel.findById(sellerId);
    if (!seller) {
      return res.redirect('/');
    }
    
    // Get rating point
    const ratingData = await reviewModel.calculateRatingPoint(sellerId);
    const rating_point = ratingData ? ratingData.rating_point : 0;
    
    // Get all reviews
    const reviews = await reviewModel.getReviewsByUserId(sellerId);
    
    // Calculate statistics
    const totalReviews = reviews.length;
    const positiveReviews = reviews.filter(r => r.rating === 1).length;
    const negativeReviews = reviews.filter(r => r.rating === -1).length;
    
    res.render('vwProduct/seller-ratings', {
      sellerName: seller.fullname,
      rating_point,
      totalReviews,
      positiveReviews,
      negativeReviews,
      reviews
    });
    
  } catch (error) {
    console.error('Error loading seller ratings page:', error);
    res.redirect('/');
  }
});

// ROUTE: Bidder Ratings Page
router.get('/bidder/:bidderId/ratings', async (req, res) => {
  try {
    const bidderId = parseInt(req.params.bidderId);
    
    if (!bidderId) {
      return res.redirect('/');
    }
    
    // Get bidder info
    const bidder = await userModel.findById(bidderId);
    if (!bidder) {
      return res.redirect('/');
    }
    
    // Get rating point
    const ratingData = await reviewModel.calculateRatingPoint(bidderId);
    const rating_point = ratingData ? ratingData.rating_point : 0;
    
    // Get all reviews
    const reviews = await reviewModel.getReviewsByUserId(bidderId);
    
    // Calculate statistics
    const totalReviews = reviews.length;
    const positiveReviews = reviews.filter(r => r.rating === 1).length;
    const negativeReviews = reviews.filter(r => r.rating === -1).length;
    
    // Mask bidder name
    const maskedName = bidder.fullname ? bidder.fullname.split('').map((char, index) => 
      index % 2 === 0 ? char : '*'
    ).join('') : '';
    
    res.render('vwProduct/bidder-ratings', {
      bidderName: maskedName,
      rating_point,
      totalReviews,
      positiveReviews,
      negativeReviews,
      reviews
    });
    
  } catch (error) {
    console.error('Error loading bidder ratings page:', error);
    res.redirect('/');
  }
});

export default router;

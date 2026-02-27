import express from 'express';
import * as reviewModel from '../../models/review.model.js';

const router = express.Router();

// Rate Bidder
router.post('/products/:id/rate', async function (req, res) {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { rating, comment, highest_bidder_id } = req.body;
        
        if (!highest_bidder_id) {
            return res.status(400).json({ success: false, message: 'No bidder to rate' });
        }
        
        // Map rating: positive -> 1, negative -> -1
        const ratingValue = rating === 'positive' ? 1 : -1;
        
        // Check if already rated
        const existingReview = await reviewModel.findByReviewerAndProduct(sellerId, productId);
        
        if (existingReview) {
            // Update existing review
            await reviewModel.updateByReviewerAndProduct(sellerId, productId, {
                rating: ratingValue,
                comment: comment || null
            });
        } else {
            // Create new review
            const reviewData = {
                reviewer_id: sellerId,
                reviewee_id: highest_bidder_id,
                product_id: productId,
                rating: ratingValue,
                comment: comment || ''
            };
            await reviewModel.createReview(reviewData);
        }
        
        res.json({ success: true, message: 'Rating submitted successfully' });
    } catch (error) {
        console.error('Rate bidder error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update Bidder Rating
router.put('/products/:id/rate', async function (req, res) {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { rating, comment, highest_bidder_id } = req.body;
        
        if (!highest_bidder_id) {
            return res.status(400).json({ success: false, message: 'No bidder to rate' });
        }
        
        // Map rating: positive -> 1, negative -> -1
        const ratingValue = rating === 'positive' ? 1 : -1;
        
        // Update review
        await reviewModel.updateReview(sellerId, highest_bidder_id, productId, {
            rating: ratingValue,
            comment: comment || ''
        });
        
        res.json({ success: true, message: 'Rating updated successfully' });
    } catch (error) {
        console.error('Update rating error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;

import express from 'express';
import * as sellerRating from '../../services/seller/rating.service.js';

const router = express.Router();

// Rate Bidder
router.post('/products/:id/rate', async function (req, res) {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { rating, comment, highest_bidder_id } = req.body;

        await sellerRating.rateBidder({
            sellerId,
            productId,
            highest_bidder_id,
            rating,
            comment,
        });

        res.json({ success: true, message: 'Rating submitted successfully' });
    } catch (error) {
        console.error('Rate bidder error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
});

// Update Bidder Rating
router.put('/products/:id/rate', async function (req, res) {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { rating, comment, highest_bidder_id } = req.body;

        await sellerRating.updateBidderRating({
            sellerId,
            productId,
            highest_bidder_id,
            rating,
            comment,
        });

        res.json({ success: true, message: 'Rating updated successfully' });
    } catch (error) {
        console.error('Update rating error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
});

export default router;

import express from 'express';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';
import * as rejectService from '../../services/seller/rejectBidder.service.js';

const router = express.Router();

// ROUTE: REJECT BIDDER (POST)
router.post('/reject-bidder', isAuthenticated, async (req, res) => {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;

  try {
    await rejectService.rejectBidder(sellerId, productId, bidderId, {
      protocol: req.protocol,
      host: req.get('host'),
    });

    res.json({ success: true, message: 'Bidder rejected successfully' });
  } catch (error) {
    console.error('Error rejecting bidder:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to reject bidder' 
    });
  }
});

// ROUTE: UNREJECT BIDDER (POST)
router.post('/unreject-bidder', isAuthenticated, async (req, res) => {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;

  try {
    await rejectService.unrejectBidder(sellerId, productId, bidderId);
    res.json({ success: true, message: 'Bidder can now bid on this product again' });
  } catch (error) {
    console.error('Error unrejecting bidder:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to unreject bidder' 
    });
  }
});

export default router;

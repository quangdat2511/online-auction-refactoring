import express from 'express';
import * as detailService from '../../services/product/detail.service.js';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';

const router = express.Router();

// GET /detail - Product detail page
router.get('/detail', async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const productId = req.query.id;

  const data = await detailService.getProductDetails(productId, userId, parseInt(req.query.commentPage) || 1);

  if (!data) {
    return res.status(404).render('404', { message: 'Product not found' });
  }
  if (data.unauthorized) {
    return res.status(403).render('403', { message: 'You do not have permission to view this product' });
  }

  // Get flash messages from session
  const success_message = req.session.success_message;
  const error_message = req.session.error_message;
  delete req.session.success_message;
  delete req.session.error_message;

  res.render('vwProduct/details', {
    ...data,
    authUser: req.session.authUser,
    success_message,
    error_message,
  });
});

// GET /bidding-history - Bidding history page (authenticated)
router.get('/bidding-history', isAuthenticated, async (req, res) => {
  const productId = req.query.id;
  if (!productId) return res.redirect('/');

  try {
    const data = await detailService.getBiddingHistoryPage(productId);
    if (!data) return res.status(404).render('404', { message: 'Product not found' });
    res.render('vwProduct/biddingHistory', data);
  } catch (error) {
    console.error('Error loading bidding history:', error);
    res.status(500).render('500', { message: 'Unable to load bidding history' });
  }
});

// GET /bid-history/:productId - Bidding history JSON
router.get('/bid-history/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const history = await detailService.getBidHistoryJSON(productId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Get bid history error:', error);
    res.status(500).json({ success: false, message: 'Unable to load bidding history' });
  }
});

export default router;

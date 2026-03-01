import express from 'express';
import * as sellerDashboard from '../../services/seller/dashboard.service.js';

const router = express.Router();

router.get('/', async function (req, res) {
  const sellerId = req.session.authUser.id;
  const stats = await sellerDashboard.getSellerStats(sellerId);
  res.render('vwSeller/dashboard', { stats });
});

export default router;

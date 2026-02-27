import express from 'express';
import * as homeService from '../services/home.service.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { topEnding, topBids, topPrice } = await homeService.getHomeProducts();
    res.render('home', {
      topEndingProducts: topEnding,
      topBidsProducts: topBids,
      topPriceProducts: topPrice
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
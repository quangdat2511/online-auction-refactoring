import express from 'express';
import * as productModel from '../models/product.model.js'; // Import model để lấy dữ liệu

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Gọi song song 3 hàm để tiết kiệm thời gian (Promise.all)
    const [topEnding, topBids, topPrice] = await Promise.all([
      productModel.findTopEnding(),
      productModel.findTopBids(),
      productModel.findTopPrice()
    ]);
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
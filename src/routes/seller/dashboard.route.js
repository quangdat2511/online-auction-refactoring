import express from 'express';
import * as productModel from '../../models/product.model.js';

const router = express.Router();

router.get('/', async function (req, res) {
    const sellerId = req.session.authUser.id;
    const stats = await productModel.getSellerStats(sellerId);
    res.render('vwSeller/dashboard', { stats });
});

export default router;

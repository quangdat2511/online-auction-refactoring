import express from 'express';

import dashboardRouter from './dashboard.route.js';
import productRouter from './product.route.js';
import ratingRouter from './rating.route.js';
import rejectBidderRouter from './rejectBidder.route.js';

const router = express.Router();

router.use('/', dashboardRouter);
router.use('/', productRouter);
router.use('/', ratingRouter);
router.use('/', rejectBidderRouter);

export default router;

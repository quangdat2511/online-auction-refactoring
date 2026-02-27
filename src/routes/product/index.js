import express from 'express';

import browseRouter from './browse.route.js';
import detailRouter from './detail.route.js';
import biddingRouter from './bidding.route.js';
import orderRouter from './order.route.js';
import commentRouter from './comment.route.js';
import ratingRouter from './rating.route.js';

const router = express.Router();

router.use('/', browseRouter);
router.use('/', detailRouter);
router.use('/', biddingRouter);
router.use('/', orderRouter);
router.use('/', commentRouter);
router.use('/', ratingRouter);

export default router;

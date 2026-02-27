import express from 'express';

import authRouter from './auth.route.js';
import profileRouter from './profile.route.js';
import bidderRouter from './bidder.route.js';

const router = express.Router();

router.use('/', authRouter);
router.use('/', profileRouter);
router.use('/', bidderRouter);

export default router;

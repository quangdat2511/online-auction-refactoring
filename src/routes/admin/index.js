import express from 'express';

import accountRouter from './account.route.js';
import userRouter from './user.route.js';
import categoryRouter from './category.route.js';
import productRouter from './product.route.js';
import systemRouter from './system.route.js';

const router = express.Router();

router.use('/account', accountRouter);
router.use('/users', userRouter);
router.use('/categories', categoryRouter);
router.use('/products', productRouter);
router.use('/system', systemRouter);

export default router;

import express from 'express';
import * as browseService from '../../services/product/browse.service.js';

const router = express.Router();

router.get('/category', async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const data = await browseService.getProductsByCategory({
    categoryId: req.query.catid,
    page: parseInt(req.query.page) || 1,
    sort: req.query.sort || '',
    userId,
  });
  res.render('vwProduct/list', data);
});

router.get('/search', async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const data = await browseService.searchProducts({
    keywords: req.query.q || '',
    page: parseInt(req.query.page) || 1,
    sort: req.query.sort || '',
    logic: req.query.logic || 'and',
    userId,
  });
  res.render('vwProduct/list', data);
});

export default router;

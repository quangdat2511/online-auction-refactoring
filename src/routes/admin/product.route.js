import express from 'express';
import * as productService from '../../services/admin/product.service.js';
import { upload } from '../../utils/upload.js';

const router = express.Router();

router.get('/list', async (req, res) => {
  const products = await productService.listProducts();
  const success_message = req.session.success_message;
  const error_message = req.session.error_message;
  delete req.session.success_message;
  delete req.session.error_message;
  res.render('vwAdmin/product/list', {
    products,
    empty: products.length === 0,
    success_message,
    error_message,
  });
});

router.get('/add', async (req, res) => {
  try {
    const sellers = await productService.getSellers();
    res.render('vwAdmin/product/add', { sellers });
  } catch (error) {
    console.error('Error loading sellers:', error);
    res.render('vwAdmin/product/add', { sellers: [], error_message: 'Failed to load sellers list' });
  }
});

router.post('/add', async (req, res) => {
  const imgsList = JSON.parse(req.body.imgs_list);
  await productService.addProduct(req.body, req.body.thumbnail, imgsList);
  res.redirect('/admin/products/list');
});

router.get('/detail/:id', async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  const success_message = req.session.success_message;
  const error_message = req.session.error_message;
  delete req.session.success_message;
  delete req.session.error_message;
  res.render('vwAdmin/product/detail', { product, success_message, error_message });
});

router.get('/edit/:id', async (req, res) => {
  const [product, sellers] = await Promise.all([
    productService.getProductById(req.params.id),
    productService.getSellers(),
  ]);
  res.render('vwAdmin/product/edit', { product, sellers });
});

router.post('/edit', async (req, res) => {
  await productService.updateProduct(req.body.id, req.body);
  req.session.success_message = 'Product updated successfully!';
  res.redirect('/admin/products/list');
});

router.post('/delete', async (req, res) => {
  await productService.deleteProduct(req.body.id);
  req.session.success_message = 'Product deleted successfully!';
  res.redirect('/admin/products/list');
});

router.post('/upload-thumbnail', upload.single('thumbnail'), (req, res) => {
  res.json({ success: true, file: req.file });
});

router.post('/upload-subimages', upload.array('images', 10), (req, res) => {
  res.json({ success: true, files: req.files });
});

export default router;

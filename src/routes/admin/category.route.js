import express from 'express';
import * as categoryService from '../../services/admin/category.service.js';

const router = express.Router();

router.get('/list', async (req, res) => {
  const categories = await categoryService.listCategories();
  const success_message = req.session.success_message;
  const error_message = req.session.error_message;
  delete req.session.success_message;
  delete req.session.error_message;
  res.render('vwAdmin/category/list', {
    categories,
    empty: categories.length === 0,
    success_message,
    error_message,
  });
});

router.get('/detail/:id', async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  res.render('vwAdmin/category/detail', { category });
});

router.get('/add', async (req, res) => {
  const parentCategories = await categoryService.getParentCategories();
  res.render('vwAdmin/category/add', { parentCategories });
});

router.get('/edit/:id', async (req, res) => {
  const [category, parentCategories] = await Promise.all([
    categoryService.getCategoryById(req.params.id),
    categoryService.getParentCategories(),
  ]);
  res.render('vwAdmin/category/edit', { category, parentCategories });
});

router.post('/add', async (req, res) => {
  const { name, parent_id } = req.body;
  await categoryService.createCategory({ name, parent_id });
  req.session.success_message = 'Category added successfully!';
  res.redirect('/admin/categories/list');
});

router.post('/edit', async (req, res) => {
  const { id, name, parent_id } = req.body;
  await categoryService.updateCategory(id, { name, parent_id });
  req.session.success_message = 'Category updated successfully!';
  res.redirect('/admin/categories/list');
});

router.post('/delete', async (req, res) => {
  const result = await categoryService.deleteCategory(req.body.id);
  if (!result.success) {
    req.session.error_message = 'Cannot delete category that has associated products.';
  } else {
    req.session.success_message = 'Category deleted successfully!';
  }
  res.redirect('/admin/categories/list');
});

export default router;
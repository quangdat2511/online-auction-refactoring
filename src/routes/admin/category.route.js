import express from 'express';
import * as categoryModel from '../../models/category.model.js';
const router = express.Router();

// Define your admin category routes here

router.get('/list', async (req, res) => {
    const categories = await categoryModel.findAll();
    const success_message = req.session.success_message;
    const error_message = req.session.error_message;
    
    // Xóa message sau khi lấy ra
    delete req.session.success_message;
    delete req.session.error_message;
    
    res.render('vwAdmin/category/list', { 
        categories,
        empty: categories.length === 0,
        success_message,
        error_message
    });
});

router.get('/detail/:id', async (req, res) => {
    const id = req.params.id;
    const category = await categoryModel.findByCategoryId(id);
    res.render('vwAdmin/category/detail', { category } );
});

router.get('/add', async (req, res) => {
    const parentCategories = await categoryModel.findLevel1Categories();
    res.render('vwAdmin/category/add', { parentCategories });
});

router.get('/edit/:id', async (req, res) => {
    const id = req.params.id;
    const category = await categoryModel.findByCategoryId(id);
    const parentCategories = await categoryModel.findLevel1Categories();
    res.render('vwAdmin/category/edit', { category, parentCategories });
});

router.post('/add', async (req, res) => {
    const { name, parent_id } = req.body;
    await categoryModel.createCategory({ name, parent_id: parent_id || null });
    req.session.success_message = 'Category added successfully!';
    res.redirect('/admin/categories/list');
});

router.post('/edit', async (req, res) => {
    const { id, name, parent_id } = req.body;
    await categoryModel.updateCategory(id, { name, parent_id: parent_id || null });
    req.session.success_message = 'Category updated successfully!';
    res.redirect('/admin/categories/list');
});

router.post('/delete', async (req, res) => {
    const { id } = req.body;
    const hasProducts = await categoryModel.isCategoryHasProducts(id);
    if (hasProducts) {
        req.session.error_message = 'Cannot delete category that has associated products.';
        return res.redirect('/admin/categories/list');
    }
    await categoryModel.deleteCategory(id);
    req.session.success_message = 'Category deleted successfully!';
    res.redirect('/admin/categories/list');
});
export default router;
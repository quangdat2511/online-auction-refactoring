import express from 'express';
import * as productModel from '../../models/product.model.js';
import * as userModel from '../../models/user.model.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

router.get('/list', async (req, res) => {
    const products = await productModel.findAll();
    const success_message = req.session.success_message;
    const error_message = req.session.error_message;
    // Xóa message sau khi lấy ra
    delete req.session.success_message;
    delete req.session.error_message;
    const filteredProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        seller_name: p.seller_name,
        current_price: p.current_price,
        highest_bidder_name: p.highest_bidder_name
    }));
    res.render('vwAdmin/product/list', {
        products : filteredProducts,
        empty: products.length === 0,
        success_message,
        error_message
    });
});


router.get('/add', async (req, res) => {
    try {
        // Lấy danh sách sellers (users có role = 'seller')
        const sellers = await userModel.findUsersByRole('seller');
        res.render('vwAdmin/product/add', { sellers });
    } catch (error) {
        console.error('Error loading sellers:', error);
        res.render('vwAdmin/product/add', { 
            sellers: [],
            error_message: 'Failed to load sellers list'
        });
    }
});

router.post('/add', async function (req, res) {
    const product = req.body;
    const productData = {
        seller_id: product.seller_id,
        category_id: product.category_id,
        name: product.name,
        starting_price: product.start_price.replace(/,/g, ''),
        step_price: product.step_price.replace(/,/g, ''),
        buy_now_price: product.buy_now_price !== '' ? product.buy_now_price.replace(/,/g, '') : null,
        created_at: product.created_at,
        end_at: product.end_date,
        auto_extend: product.auto_extend === '1' ? true : false,
        thumbnail: null,  // to be updated after upload
        description: product.description,
        highest_bidder_id: null,
        current_price: product.start_price.replace(/,/g, ''),
        is_sold: null,
        closed_at: null,
        allow_unrated_bidder: product.allow_new_bidders === '1' ? true : false
    }
    // console.log('productData:', productData);
    const returnedID = await productModel.addProduct(productData);

    const dirPath = path.join('public', 'images', 'products').replace(/\\/g, "/");

    const imgs = JSON.parse(product.imgs_list);

    // Move and rename thumbnail
    const mainPath = path.join(dirPath, `p${returnedID[0].id}_thumb.jpg`).replace(/\\/g, "/");
    const oldMainPath = path.join('public', 'uploads', path.basename(product.thumbnail)).replace(/\\/g, "/");
    const savedMainPath = '/' + path.join('images', 'products', `p${returnedID[0].id}_thumb.jpg`).replace(/\\/g, "/");
    fs.renameSync(oldMainPath, mainPath);
    await productModel.updateProductThumbnail(returnedID[0].id, savedMainPath);

    // Move and rename subimages 
    let i = 1;
    let newImgPaths = [];
    for (const imgPath of imgs) {
        const oldPath = path.join('public', 'uploads', path.basename(imgPath)).replace(/\\/g, "/");
        const newPath = path.join(dirPath, `p${returnedID[0].id}_${i}.jpg`).replace(/\\/g, "/");
        const savedPath = '/' + path.join('images', 'products', `p${returnedID[0].id}_${i}.jpg`).replace(/\\/g, "/");
        fs.renameSync(oldPath, newPath);
        newImgPaths.push({
            product_id: returnedID[0].id,
            img_link: savedPath
        });
        i++;
    }
    await productModel.addProductImages(newImgPaths);
    res.redirect('/admin/products/list');
});
router.get('/detail/:id', async (req, res) => {
    const id = req.params.id;
    const product = await productModel.findByProductIdForAdmin(id);
    // console.log(product);
    const success_message = req.session.success_message;
    const error_message = req.session.error_message;
    delete req.session.success_message;
    delete req.session.error_message
    res.render('vwAdmin/product/detail', { product } );
});

router.get('/edit/:id', async (req, res) => {
    const id = req.params.id;
    const product = await productModel.findByProductIdForAdmin(id);
    // console.log(product)
    const sellers = await userModel.findUsersByRole('seller');
    // console.log(product);
    res.render('vwAdmin/product/edit', { product, sellers } );
});

router.post('/edit', async (req, res) => {
    const newProduct = req.body;
    await productModel.updateProduct(newProduct.id, newProduct);
    req.session.success_message = 'Product updated successfully!';
    res.redirect('/admin/products/list');
});

router.post('/delete', async (req, res) => {
    const { id } = req.body;
    await productModel.deleteProduct(id);
    req.session.success_message = 'Product deleted successfully!';
    res.redirect('/admin/products/list');
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

router.post('/upload-thumbnail', upload.single('thumbnail'), async function (req, res) {
    res.json({
        success: true,
        file: req.file
    });
});

router.post('/upload-subimages', upload.array('images', 10), async function (req, res) {
    res.json({
        success: true,
        files: req.files
    });
});

export default router;
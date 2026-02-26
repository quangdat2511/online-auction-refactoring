import express from 'express';
import * as productModel from '../models/product.model.js';
import * as reviewModel from '../models/review.model.js';
import * as productDescUpdateModel from '../models/productDescriptionUpdate.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as productCommentModel from '../models/productComment.model.js';
import { sendMail } from '../utils/mailer.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

router.get('/', async function (req, res) {
    const sellerId = req.session.authUser.id;
    const stats = await productModel.getSellerStats(sellerId);
    res.render('vwSeller/dashboard', { stats });
});

// All Products - View only
router.get('/products', async function (req, res) {
    const sellerId = req.session.authUser.id;
    const products = await productModel.findAllProductsBySellerId(sellerId);
    res.render('vwSeller/all-products', { products });
});

// Active Products - CRUD
router.get('/products/active', async function (req, res) {
    const sellerId = req.session.authUser.id;
    const products = await productModel.findActiveProductsBySellerId(sellerId);
    res.render('vwSeller/active', { products });
});

// Pending Products - Waiting for payment
router.get('/products/pending', async function (req, res) {
    const sellerId = req.session.authUser.id;
    const [products, stats] = await Promise.all([
        productModel.findPendingProductsBySellerId(sellerId),
        productModel.getPendingProductsStats(sellerId)
    ]);
    
    // Lấy message từ query param
    let success_message = '';
    if (req.query.message === 'cancelled') {
        success_message = 'Auction cancelled successfully!';
    }
    
    res.render('vwSeller/pending', { products, stats, success_message });
});

// Sold Products - Paid successfully
router.get('/products/sold', async function (req, res) {
    const sellerId = req.session.authUser.id;
    const [products, stats] = await Promise.all([
        productModel.findSoldProductsBySellerId(sellerId),
        productModel.getSoldProductsStats(sellerId)
    ]);
    
    // Fetch review info for each product
    const productsWithReview = await Promise.all(products.map(async (product) => {
        const review = await reviewModel.getProductReview(sellerId, product.highest_bidder_id, product.id);
        
        // Only show review if rating is not 0 (actual rating, not skip)
        const hasActualReview = review && review.rating !== 0;
        
        return {
            ...product,
            hasReview: hasActualReview,
            reviewRating: hasActualReview ? (review.rating === 1 ? 'positive' : 'negative') : null,
            reviewComment: hasActualReview ? review.comment : ''
        };
    }));
    
    res.render('vwSeller/sold-products', { products: productsWithReview, stats });
});

// Expired Products - No bidder or cancelled
router.get('/products/expired', async function (req, res) {
    const sellerId = req.session.authUser.id;
    const products = await productModel.findExpiredProductsBySellerId(sellerId);
    
    // Add review info for cancelled products with bidders
    for (let product of products) {
        if (product.status === 'Cancelled' && product.highest_bidder_id) {
            const review = await reviewModel.getProductReview(sellerId, product.highest_bidder_id, product.id);
            // Only show review if rating is not 0 (actual rating, not skip)
            const hasActualReview = review && review.rating !== 0;
            
            product.hasReview = hasActualReview;
            if (hasActualReview) {
                product.reviewRating = review.rating === 1 ? 'positive' : 'negative';
                product.reviewComment = review.comment;
            }
        }
    }
    
    res.render('vwSeller/expired', { products });
});

router.get('/products/add', async function (req, res) {
    const success_message = req.session.success_message;
    delete req.session.success_message; // Xóa message sau khi hiển thị
    res.render('vwSeller/add', { success_message });
});

router.post('/products/add', async function (req, res) {
    const product = req.body;
    // console.log('product:', product);
    const sellerId = req.session.authUser.id;
    // console.log('sellerId:', sellerId);
    
    // Parse UTC ISO strings from client
    const createdAtUTC = new Date(product.created_at);
    const endAtUTC = new Date(product.end_date);
    
    const productData = {
        seller_id: sellerId,
        category_id: product.category_id,
        name: product.name,
        starting_price: product.start_price.replace(/,/g, ''),
        step_price: product.step_price.replace(/,/g, ''),
        buy_now_price: product.buy_now_price !== '' ? product.buy_now_price.replace(/,/g, '') : null,
        created_at: createdAtUTC,
        end_at: endAtUTC,
        auto_extend: product.auto_extend === '1' ? true : false,
        thumbnail: null,  // to be updated after upload
        description: product.description,
        highest_bidder_id: null,
        current_price: product.start_price.replace(/,/g, ''),
        is_sold: null,
        allow_unrated_bidder: product.allow_new_bidders === '1' ? true : false,
        closed_at: null
    }
    console.log('productData:', productData);
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

    console.log('subimagesData:', newImgPaths);
    await productModel.addProductImages(newImgPaths);
    
    // Lưu success message vào session
    req.session.success_message = 'Product added successfully!';
    res.redirect('/seller/products/add');
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

router.post('/products/upload-thumbnail', upload.single('thumbnail'), async function (req, res) {
    res.json({
        success: true,
        file: req.file
    });
});

router.post('/products/upload-subimages', upload.array('images', 10), async function (req, res) {
    res.json({
        success: true,
        files: req.files
    });
});

// Cancel Product
router.post('/products/:id/cancel', async function (req, res) {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { reason, highest_bidder_id } = req.body;
        
        // Cancel product
        const product = await productModel.cancelProduct(productId, sellerId);
        
        // Create review if there's a bidder
        if (highest_bidder_id) {
            const reviewModule = await import('../models/review.model.js');
            const reviewData = {
                reviewer_id: sellerId,
                reviewee_id: highest_bidder_id,
                product_id: productId,
                rating: -1,
                comment: reason || 'Auction cancelled by seller'
            };
            await reviewModule.createReview(reviewData);
        }
        
        res.json({ success: true, message: 'Auction cancelled successfully' });
    } catch (error) {
        console.error('Cancel product error:', error);
        
        if (error.message === 'Product not found') {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        if (error.message === 'Unauthorized') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Rate Bidder
router.post('/products/:id/rate', async function (req, res) {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { rating, comment, highest_bidder_id } = req.body;
        
        if (!highest_bidder_id) {
            return res.status(400).json({ success: false, message: 'No bidder to rate' });
        }
        
        // Map rating: positive -> 1, negative -> -1
        const ratingValue = rating === 'positive' ? 1 : -1;
        
        // Check if already rated
        const existingReview = await reviewModel.findByReviewerAndProduct(sellerId, productId);
        
        if (existingReview) {
            // Update existing review
            await reviewModel.updateByReviewerAndProduct(sellerId, productId, {
                rating: ratingValue,
                comment: comment || null
            });
        } else {
            // Create new review
            const reviewData = {
                reviewer_id: sellerId,
                reviewee_id: highest_bidder_id,
                product_id: productId,
                rating: ratingValue,
                comment: comment || ''
            };
            await reviewModel.createReview(reviewData);
        }
        
        res.json({ success: true, message: 'Rating submitted successfully' });
    } catch (error) {
        console.error('Rate bidder error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update Bidder Rating
router.put('/products/:id/rate', async function (req, res) {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { rating, comment, highest_bidder_id } = req.body;
        
        if (!highest_bidder_id) {
            return res.status(400).json({ success: false, message: 'No bidder to rate' });
        }
        
        // Map rating: positive -> 1, negative -> -1
        const ratingValue = rating === 'positive' ? 1 : -1;
        
        // Update review
        await reviewModel.updateReview(sellerId, highest_bidder_id, productId, {
            rating: ratingValue,
            comment: comment || ''
        });
        
        res.json({ success: true, message: 'Rating updated successfully' });
    } catch (error) {
        console.error('Update rating error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Append Description to Product
router.post('/products/:id/append-description', async function (req, res) {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { description } = req.body;
        
        if (!description || description.trim() === '') {
            return res.status(400).json({ success: false, message: 'Description is required' });
        }
        
        // Verify that the product belongs to the seller
        const product = await productModel.findByProductId2(productId, null);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        if (product.seller_id !== sellerId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        // Add description update
        await productDescUpdateModel.addUpdate(productId, description.trim());
        
        // Get unique bidders and commenters to notify
        const [bidders, commenters] = await Promise.all([
            biddingHistoryModel.getUniqueBidders(productId),
            productCommentModel.getUniqueCommenters(productId)
        ]);
        
        // Combine and deduplicate by email (exclude seller)
        const notifyMap = new Map();
        [...bidders, ...commenters].forEach(user => {
            if (user.id !== sellerId && !notifyMap.has(user.email)) {
                notifyMap.set(user.email, user);
            }
        });
        
        // Send email notifications (non-blocking)
        const notifyUsers = Array.from(notifyMap.values());
        if (notifyUsers.length > 0) {
            const productUrl = `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;
            
            // Send emails in background (don't await)
            Promise.all(notifyUsers.map(user => {
                return sendMail({
                    to: user.email,
                    subject: `[Auction Update] New description added for "${product.name}"`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9bb8 100%); padding: 20px; text-align: center;">
                                <h1 style="color: white; margin: 0;">Product Description Updated</h1>
                            </div>
                            <div style="padding: 20px; background: #f9f9f9;">
                                <p>Hello <strong>${user.fullname}</strong>,</p>
                                <p>The seller has added new information to the product description:</p>
                                <div style="background: white; padding: 15px; border-left: 4px solid #72AEC8; margin: 15px 0;">
                                    <h3 style="margin: 0 0 10px 0; color: #333;">${product.name}</h3>
                                    <p style="margin: 0; color: #666;">Current Price: <strong style="color: #72AEC8;">${new Intl.NumberFormat('en-US').format(product.current_price)} VND</strong></p>
                                </div>
                                <div style="background: #fff8e1; padding: 15px; border-radius: 5px; margin: 15px 0;">
                                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #f57c00;"><i>✉</i> New Description Added:</p>
                                    <div style="color: #333;">${description.trim()}</div>
                                </div>
                                <p>View the product to see the full updated description:</p>
                                <a href="${productUrl}" style="display: inline-block; background: #72AEC8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 10px 0;">View Product</a>
                                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                                <p style="color: #999; font-size: 12px;">You received this email because you placed a bid or asked a question on this product.</p>
                            </div>
                        </div>
                    `
                }).catch(err => console.error('Failed to send email to', user.email, err));
            })).catch(err => console.error('Email notification error:', err));
        }
        
        res.json({ success: true, message: 'Description appended successfully' });
    } catch (error) {
        console.error('Append description error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get Description Updates for a Product
router.get('/products/:id/description-updates', async function (req, res) {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        
        // Verify that the product belongs to the seller
        const product = await productModel.findByProductId2(productId, null);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        if (product.seller_id !== sellerId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        // Get all description updates for this product
        const updates = await productDescUpdateModel.findByProductId(productId);
        
        res.json({ success: true, updates });
    } catch (error) {
        console.error('Get description updates error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update a Description Update
router.put('/products/description-updates/:updateId', async function (req, res) {
    try {
        const updateId = req.params.updateId;
        const sellerId = req.session.authUser.id;
        const { content } = req.body;
        
        if (!content || content.trim() === '') {
            return res.status(400).json({ success: false, message: 'Content is required' });
        }
        
        // Get the update to verify ownership
        const update = await productDescUpdateModel.findById(updateId);
        if (!update) {
            return res.status(404).json({ success: false, message: 'Update not found' });
        }
        
        // Verify that the product belongs to the seller
        const product = await productModel.findByProductId2(update.product_id, null);
        if (!product || product.seller_id !== sellerId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        // Update the content
        await productDescUpdateModel.updateContent(updateId, content.trim());
        
        res.json({ success: true, message: 'Update saved successfully' });
    } catch (error) {
        console.error('Update description error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete a Description Update
router.delete('/products/description-updates/:updateId', async function (req, res) {
    try {
        const updateId = req.params.updateId;
        const sellerId = req.session.authUser.id;
        
        // Get the update to verify ownership
        const update = await productDescUpdateModel.findById(updateId);
        if (!update) {
            return res.status(404).json({ success: false, message: 'Update not found' });
        }
        
        // Verify that the product belongs to the seller
        const product = await productModel.findByProductId2(update.product_id, null);
        if (!product || product.seller_id !== sellerId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        // Delete the update
        await productDescUpdateModel.deleteUpdate(updateId);
        
        res.json({ success: true, message: 'Update deleted successfully' });
    } catch (error) {
        console.error('Delete description error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
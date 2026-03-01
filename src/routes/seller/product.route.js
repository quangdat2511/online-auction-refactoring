import express from 'express';
import * as sellerProductService from '../../services/seller/product.service.js';
import { upload } from '../../utils/upload.js';

const router = express.Router();

// All Products - View only
router.get('/products', async function (req, res) {
  const sellerId = req.session.authUser.id;
  const products = await sellerProductService.getAllProducts(sellerId);
  res.render('vwSeller/all-products', { products });
});

// Active Products - CRUD
router.get('/products/active', async function (req, res) {
  const sellerId = req.session.authUser.id;
  const products = await sellerProductService.getActiveProducts(sellerId);
  res.render('vwSeller/active', { products });
});

// Pending Products - Waiting for payment
router.get('/products/pending', async function (req, res) {
  const sellerId = req.session.authUser.id;
  const { products, stats } = await sellerProductService.getPendingProducts(sellerId);
  
  // Read cancellation message from query param
  let success_message = '';
  if (req.query.message === 'cancelled') {
    success_message = 'Auction cancelled successfully!';
  }
  
  res.render('vwSeller/pending', { products, stats, success_message });
});

// Sold Products - Paid successfully
router.get('/products/sold', async function (req, res) {
  const sellerId = req.session.authUser.id;
  const { products, stats } = await sellerProductService.getSoldProducts(sellerId);
  res.render('vwSeller/sold-products', { products, stats });
});

// Expired Products - No bidder or cancelled
router.get('/products/expired', async function (req, res) {
  const sellerId = req.session.authUser.id;
  const products = await sellerProductService.getExpiredProducts(sellerId);
  res.render('vwSeller/expired', { products });
});

router.get('/products/add', async function (req, res) {
  const success_message = req.session.success_message;
  delete req.session.success_message; // Clear message after display
  res.render('vwSeller/add', { success_message });
});

router.post('/products/add', async function (req, res) {
  const product = req.body;
  const sellerId = req.session.authUser.id;
  
  const imgs = JSON.parse(product.imgs_list);
  
  try {
    const productId = await sellerProductService.addProduct(sellerId, product, imgs);
    req.session.success_message = 'Product added successfully!';
    res.redirect('/seller/products/add');
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/products/upload-thumbnail', upload.single('thumbnail'), async function (req, res) {
  res.json({ success: true, file: req.file });
});

router.post('/products/upload-subimages', upload.array('images', 10), async function (req, res) {
  res.json({ success: true, files: req.files });
});

// Cancel Product
router.post('/products/:id/cancel', async function (req, res) {
  try {
    const productId = req.params.id;
    const sellerId = req.session.authUser.id;
    const { reason, highest_bidder_id } = req.body;
    
    await sellerProductService.cancelProduct(
      sellerId,
      productId,
      reason,
      highest_bidder_id
    );
    
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

// Append Description to Product
router.post('/products/:id/append-description', async function (req, res) {
  try {
    const productId = req.params.id;
    const sellerId = req.session.authUser.id;
    const { description } = req.body;
    
    const notifyOptions = {
      protocol: req.protocol,
      host: req.get('host')
    };
    
    await sellerProductService.appendDescription(
      sellerId,
      productId,
      description,
      notifyOptions
    );
    
    res.json({ success: true, message: 'Description appended successfully' });
  } catch (error) {
    console.error('Append description error:', error);
    
    if (error.message === 'Description is required') {
      return res.status(400).json({ success: false, message: 'Description is required' });
    }
    if (error.message === 'Product not found') {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Description Updates for a Product
router.get('/products/:id/description-updates', async function (req, res) {
  try {
    const productId = req.params.id;
    const sellerId = req.session.authUser.id;
    
    const updates = await sellerProductService.getDescriptionUpdates(sellerId, productId);
    
    res.json({ success: true, updates });
  } catch (error) {
    console.error('Get description updates error:', error);
    
    if (error.message === 'Product not found') {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update a Description Update
router.put('/products/description-updates/:updateId', async function (req, res) {
  try {
    const updateId = req.params.updateId;
    const sellerId = req.session.authUser.id;
    const { content } = req.body;
    
    await sellerProductService.updateDescriptionUpdate(sellerId, updateId, content);
    
    res.json({ success: true, message: 'Update saved successfully' });
  } catch (error) {
    console.error('Update description error:', error);
    
    if (error.message === 'Content is required') {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }
    if (error.message === 'Update not found') {
      return res.status(404).json({ success: false, message: 'Update not found' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a Description Update
router.delete('/products/description-updates/:updateId', async function (req, res) {
  try {
    const updateId = req.params.updateId;
    const sellerId = req.session.authUser.id;
    
    await sellerProductService.deleteDescriptionUpdate(sellerId, updateId);
    
    res.json({ success: true, message: 'Update deleted successfully' });
  } catch (error) {
    console.error('Delete description error:', error);
    
    if (error.message === 'Update not found') {
      return res.status(404).json({ success: false, message: 'Update not found' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;

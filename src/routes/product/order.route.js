import express from 'express';
import * as productModel from '../../models/product.model.js';
import * as reviewModel from '../../models/review.model.js';
import * as orderModel from '../../models/order.model.js';
import * as invoiceModel from '../../models/invoice.model.js';
import * as orderChatModel from '../../models/orderChat.model.js';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';
import db from '../../utils/db.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// ROUTE: COMPLETE ORDER PAGE (For PENDING products)
router.get('/complete-order', isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.query.id;
  
  if (!productId) {
    return res.redirect('/');
  }
  
  const product = await productModel.findByProductId2(productId, userId);
  
  if (!product) {
    return res.status(404).render('404', { message: 'Product not found' });
  }
  
  // Determine product status
  const now = new Date();
  const endDate = new Date(product.end_at);
  let productStatus = 'ACTIVE';
  
  if (product.is_sold === true) {
    productStatus = 'SOLD';
  } else if (product.is_sold === false) {
    productStatus = 'CANCELLED';
  } else if ((endDate <= now || product.closed_at) && product.highest_bidder_id) {
    productStatus = 'PENDING';
  } else if (endDate <= now && !product.highest_bidder_id) {
    productStatus = 'EXPIRED';
  }
  
  // Only PENDING products can access this page
  if (productStatus !== 'PENDING') {
    return res.redirect(`/products/detail?id=${productId}`);
  }
  
  // Only seller or highest bidder can access
  const isSeller = product.seller_id === userId;
  const isHighestBidder = product.highest_bidder_id === userId;
  
  if (!isSeller && !isHighestBidder) {
    return res.status(403).render('403', { message: 'You do not have permission to access this page' });
  }
  
  // Fetch or create order
  let order = await orderModel.findByProductId(productId);
  
  if (!order) {
    // Auto-create order if not exists (trigger should handle this, but fallback)
    const orderData = {
      product_id: productId,
      buyer_id: product.highest_bidder_id,
      seller_id: product.seller_id,
      final_price: product.current_price || product.highest_bid || 0
    };
    await orderModel.createOrder(orderData);
    order = await orderModel.findByProductId(productId);
  }
  
  // Fetch invoices
  let paymentInvoice = await invoiceModel.getPaymentInvoice(order.id);
  let shippingInvoice = await invoiceModel.getShippingInvoice(order.id);
  
  // Parse PostgreSQL arrays to JavaScript arrays
  if (paymentInvoice && paymentInvoice.payment_proof_urls) {
    console.log('Original payment_proof_urls:', paymentInvoice.payment_proof_urls);
    console.log('Type:', typeof paymentInvoice.payment_proof_urls);
    
    if (typeof paymentInvoice.payment_proof_urls === 'string') {
      // PostgreSQL returns array as string like: {url1,url2,url3}
      paymentInvoice.payment_proof_urls = paymentInvoice.payment_proof_urls
        .replace(/^\{/, '')
        .replace(/\}$/, '')
        .split(',')
        .filter(url => url);
      console.log('Parsed payment_proof_urls:', paymentInvoice.payment_proof_urls);
    }
  }
  
  if (shippingInvoice && shippingInvoice.shipping_proof_urls) {
    if (typeof shippingInvoice.shipping_proof_urls === 'string') {
      shippingInvoice.shipping_proof_urls = shippingInvoice.shipping_proof_urls
        .replace(/^\{/, '')
        .replace(/\}$/, '')
        .split(',')
        .filter(url => url);
    }
  }
  
  // Fetch chat messages
  const messages = await orderChatModel.getMessagesByOrderId(order.id);
  
  res.render('vwProduct/complete-order', {
    product,
    order,
    paymentInvoice,
    shippingInvoice,
    messages,
    isSeller,
    isHighestBidder,
    currentUserId: userId
  });
});

// ===================================================================================
// IMAGE UPLOAD FOR PAYMENT/SHIPPING PROOFS
// ===================================================================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif)!'));
    }
  }
});

router.post('/order/upload-images', isAuthenticated, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const urls = req.files.map(file => `uploads/${file.filename}`);
    res.json({ success: true, urls });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// ===================================================================================
// ORDER PAYMENT & SHIPPING ROUTES
// ===================================================================================

// Submit payment (Buyer)
router.post('/order/:orderId/submit-payment', isAuthenticated, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const { payment_method, payment_proof_urls, note, shipping_address, shipping_phone } = req.body;
    
    // Verify user is buyer
    const order = await orderModel.findById(orderId);
    if (!order || order.buyer_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Create payment invoice
    await invoiceModel.createPaymentInvoice({
      order_id: orderId,
      issuer_id: userId,
      payment_method,
      payment_proof_urls,
      note
    });
    
    // Update order
    await orderModel.updateShippingInfo(orderId, {
      shipping_address,
      shipping_phone
    });
    
    await orderModel.updateStatus(orderId, 'payment_submitted', userId);
    
    res.json({ success: true, message: 'Payment submitted successfully' });
  } catch (error) {
    console.error('Submit payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit payment' });
  }
});

// Confirm payment (Seller)
router.post('/order/:orderId/confirm-payment', isAuthenticated, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    // Verify user is seller
    const order = await orderModel.findById(orderId);
    if (!order || order.seller_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Verify payment invoice
    const paymentInvoice = await invoiceModel.getPaymentInvoice(orderId);
    if (!paymentInvoice) {
      return res.status(400).json({ error: 'No payment invoice found' });
    }
    
    await invoiceModel.verifyInvoice(paymentInvoice.id);
    await orderModel.updateStatus(orderId, 'payment_confirmed', userId);
    
    res.json({ success: true, message: 'Payment confirmed successfully' });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm payment' });
  }
});

// Submit shipping (Seller)
router.post('/order/:orderId/submit-shipping', isAuthenticated, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const { tracking_number, shipping_provider, shipping_proof_urls, note } = req.body;
    
    // Verify user is seller
    const order = await orderModel.findById(orderId);
    if (!order || order.seller_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Create shipping invoice
    await invoiceModel.createShippingInvoice({
      order_id: orderId,
      issuer_id: userId,
      tracking_number,
      shipping_provider,
      shipping_proof_urls,
      note
    });
    
    await orderModel.updateStatus(orderId, 'shipped', userId);
    
    res.json({ success: true, message: 'Shipping info submitted successfully' });
  } catch (error) {
    console.error('Submit shipping error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit shipping' });
  }
});

// Confirm delivery (Buyer)
router.post('/order/:orderId/confirm-delivery', isAuthenticated, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    // Verify user is buyer
    const order = await orderModel.findById(orderId);
    if (!order || order.buyer_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await orderModel.updateStatus(orderId, 'delivered', userId);
    
    res.json({ success: true, message: 'Delivery confirmed successfully' });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm delivery' });
  }
});

// Submit rating (Both)
router.post('/order/:orderId/submit-rating', isAuthenticated, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const { rating, comment } = req.body;
    
    // Verify user is buyer or seller
    const order = await orderModel.findById(orderId);
    if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Determine who is being rated
    const isBuyer = order.buyer_id === userId;
    const reviewerId = userId;
    const revieweeId = isBuyer ? order.seller_id : order.buyer_id;
    
    // Convert rating to number (positive = 1, negative = -1)
    const ratingValue = rating === 'positive' ? 1 : -1;
    
    // Check if already rated
    const existingReview = await reviewModel.findByReviewerAndProduct(reviewerId, order.product_id);
    
    if (existingReview) {
      // Update existing review
      await reviewModel.updateByReviewerAndProduct(reviewerId, order.product_id, {
        rating: ratingValue,
        comment: comment || null
      });
    } else {
      // Create new review (using existing create function)
      await reviewModel.create({
        reviewer_id: reviewerId,
        reviewed_user_id: revieweeId,
        product_id: order.product_id,
        rating: ratingValue,
        comment: comment || null
      });
    }
    
    // Check if both parties have completed (rated or skipped)
    const buyerReview = await reviewModel.getProductReview(order.buyer_id, order.seller_id, order.product_id);
    const sellerReview = await reviewModel.getProductReview(order.seller_id, order.buyer_id, order.product_id);
    
    if (buyerReview && sellerReview) {
      // Both completed, mark order as completed
      await orderModel.updateStatus(orderId, 'completed', userId);
      
      // Update product as sold and set closed_at to payment completion time
      await db('products').where('id', order.product_id).update({ 
        is_sold: true,
        closed_at: new Date()
      });
    }
    
    res.json({ success: true, message: 'Rating submitted successfully' });
  } catch (error) {
    console.error('Submit rating error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit rating' });
  }
});

// Complete transaction without rating (skip)
router.post('/order/:orderId/complete-transaction', isAuthenticated, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    // Verify user is buyer or seller
    const order = await orderModel.findById(orderId);
    if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Determine who is being rated
    const isBuyer = order.buyer_id === userId;
    const reviewerId = userId;
    const revieweeId = isBuyer ? order.seller_id : order.buyer_id;
    
    // Create review record with rating=0 to indicate "skipped"
    const existingReview = await reviewModel.findByReviewerAndProduct(reviewerId, order.product_id);
    
    if (!existingReview) {
      await reviewModel.create({
        reviewer_id: reviewerId,
        reviewed_user_id: revieweeId,
        product_id: order.product_id,
        rating: 0, // 0 means skipped
        comment: null
      });
    }
    
    // Check if both parties have completed (rated or skipped)
    const buyerReview = await reviewModel.getProductReview(order.buyer_id, order.seller_id, order.product_id);
    const sellerReview = await reviewModel.getProductReview(order.seller_id, order.buyer_id, order.product_id);
    
    if (buyerReview && sellerReview) {
      // Both completed, mark order as completed
      await orderModel.updateStatus(orderId, 'completed', userId);
      
      // Update product as sold and set closed_at to payment completion time
      await db('products').where('id', order.product_id).update({ 
        is_sold: true,
        closed_at: new Date()
      });
    }
    
    res.json({ success: true, message: 'Transaction completed' });
  } catch (error) {
    console.error('Complete transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to complete transaction' });
  }
});

// Send message (Chat)
router.post('/order/:orderId/send-message', isAuthenticated, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const { message } = req.body;
    
    // Verify user is buyer or seller
    const order = await orderModel.findById(orderId);
    if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await orderChatModel.sendMessage({
      order_id: orderId,
      sender_id: userId,
      message
    });
    
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Get chat messages for an order
router.get('/order/:orderId/messages', isAuthenticated, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    // Verify user is buyer or seller
    const order = await orderModel.findById(orderId);
    if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Get messages
    const messages = await orderChatModel.getMessagesByOrderId(orderId);
    
    // Generate HTML for messages
    let messagesHtml = '';
    messages.forEach(msg => {
      const isSent = msg.sender_id === userId;
      const messageClass = isSent ? 'text-end' : '';
      const bubbleClass = isSent ? 'sent' : 'received';
      
      // Format date: HH:mm:ss DD/MM/YYYY
      const msgDate = new Date(msg.created_at);
      const year = msgDate.getFullYear();
      const month = String(msgDate.getMonth() + 1).padStart(2, '0');
      const day = String(msgDate.getDate()).padStart(2, '0');
      const hour = String(msgDate.getHours()).padStart(2, '0');
      const minute = String(msgDate.getMinutes()).padStart(2, '0');
      const second = String(msgDate.getSeconds()).padStart(2, '0');
      const formattedDate = `${hour}:${minute}:${second} ${day}/${month}/${year}`;
      
      messagesHtml += `
        <div class="chat-message ${messageClass}">
          <div class="chat-bubble ${bubbleClass}">
            <div>${msg.message}</div>
            <div style="font-size: 0.7rem; margin-top: 3px; opacity: 0.8;">${formattedDate}</div>
          </div>
        </div>
      `;
    });
    
    res.json({ success: true, messagesHtml });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: error.message || 'Failed to get messages' });
  }
});

export default router;

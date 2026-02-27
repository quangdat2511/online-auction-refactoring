import express from 'express';
import * as orderService from '../../services/product/order.service.js';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';
import { uploadImage as upload } from '../../utils/upload.js';

const router = express.Router();

router.get('/complete-order', isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.query.id;
  if (!productId) return res.redirect('/');

  const data = await orderService.getCompleteOrderPage(productId, userId);
  if (!data) return res.status(404).render('404', { message: 'Product not found' });
  if (data.redirect) return res.redirect(data.redirect);
  if (data.unauthorized) return res.status(403).render('403', { message: 'You do not have permission to access this page' });

  res.render('vwProduct/complete-order', { ...data, currentUserId: userId });
});

router.post('/order/upload-images', isAuthenticated, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const urls = req.files.map(file => `uploads/${file.filename}`);
    res.json({ success: true, urls });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

router.post('/order/:orderId/submit-payment', isAuthenticated, async (req, res) => {
  try {
    await orderService.submitPayment(req.params.orderId, req.session.authUser.id, req.body);
    res.json({ success: true, message: 'Payment submitted successfully' });
  } catch (error) {
    res.status(error.message === 'Unauthorized' ? 403 : 500).json({ error: error.message || 'Failed to submit payment' });
  }
});

router.post('/order/:orderId/confirm-payment', isAuthenticated, async (req, res) => {
  try {
    await orderService.confirmPayment(req.params.orderId, req.session.authUser.id);
    res.json({ success: true, message: 'Payment confirmed successfully' });
  } catch (error) {
    res.status(error.message === 'Unauthorized' ? 403 : 500).json({ error: error.message || 'Failed to confirm payment' });
  }
});

router.post('/order/:orderId/submit-shipping', isAuthenticated, async (req, res) => {
  try {
    await orderService.submitShipping(req.params.orderId, req.session.authUser.id, req.body);
    res.json({ success: true, message: 'Shipping info submitted successfully' });
  } catch (error) {
    res.status(error.message === 'Unauthorized' ? 403 : 500).json({ error: error.message || 'Failed to submit shipping' });
  }
});

router.post('/order/:orderId/confirm-delivery', isAuthenticated, async (req, res) => {
  try {
    await orderService.confirmDelivery(req.params.orderId, req.session.authUser.id);
    res.json({ success: true, message: 'Delivery confirmed successfully' });
  } catch (error) {
    res.status(error.message === 'Unauthorized' ? 403 : 500).json({ error: error.message || 'Failed to confirm delivery' });
  }
});

router.post('/order/:orderId/submit-rating', isAuthenticated, async (req, res) => {
  try {
    await orderService.submitRating(req.params.orderId, req.session.authUser.id, req.body);
    res.json({ success: true, message: 'Rating submitted successfully' });
  } catch (error) {
    res.status(error.message === 'Unauthorized' ? 403 : 500).json({ error: error.message || 'Failed to submit rating' });
  }
});

router.post('/order/:orderId/complete-transaction', isAuthenticated, async (req, res) => {
  try {
    await orderService.completeTransaction(req.params.orderId, req.session.authUser.id);
    res.json({ success: true, message: 'Transaction completed' });
  } catch (error) {
    res.status(error.message === 'Unauthorized' ? 403 : 500).json({ error: error.message || 'Failed to complete transaction' });
  }
});

router.post('/order/:orderId/send-message', isAuthenticated, async (req, res) => {
  try {
    await orderService.sendMessage(req.params.orderId, req.session.authUser.id, req.body.message);
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    res.status(error.message === 'Unauthorized' ? 403 : 500).json({ error: error.message || 'Failed to send message' });
  }
});

router.get('/order/:orderId/messages', isAuthenticated, async (req, res) => {
  try {
    const messagesHtml = await orderService.getMessagesHTML(req.params.orderId, req.session.authUser.id);
    res.json({ success: true, messagesHtml });
  } catch (error) {
    res.status(error.message === 'Unauthorized' ? 403 : 500).json({ error: error.message || 'Failed to get messages' });
  }
});

export default router;

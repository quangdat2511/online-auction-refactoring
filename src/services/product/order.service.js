import { productModel, reviewModel, orderModel, invoiceModel, orderChatModel } from '../../models/index.js';
import { determineProductStatus } from './detail.service.js';

function parsePostgresArray(value) {
  if (!value || typeof value !== 'string') return value;
  return value
    .replace(/^\{/, '')
    .replace(/\}$/, '')
    .split(',')
    .filter(url => url);
}

export async function getCompleteOrderPage(productId, userId) {
  const product = await productModel.findByProductId2(productId, userId);
  if (!product) return null;

  const productStatus = determineProductStatus(product);

  if (productStatus !== 'PENDING') return { redirect: `/products/detail?id=${productId}` };

  const isSeller = product.seller_id === userId;
  const isHighestBidder = product.highest_bidder_id === userId;

  if (!isSeller && !isHighestBidder) return { unauthorized: true };

  let order = await orderModel.findByProductId(productId);
  if (!order) {
    await orderModel.createOrder({
      product_id: productId,
      buyer_id: product.highest_bidder_id,
      seller_id: product.seller_id,
      final_price: product.current_price || product.highest_bid || 0,
    });
    order = await orderModel.findByProductId(productId);
  }

  let paymentInvoice = await invoiceModel.getPaymentInvoice(order.id);
  let shippingInvoice = await invoiceModel.getShippingInvoice(order.id);

  if (paymentInvoice?.payment_proof_urls) {
    paymentInvoice.payment_proof_urls = parsePostgresArray(paymentInvoice.payment_proof_urls);
  }
  if (shippingInvoice?.shipping_proof_urls) {
    shippingInvoice.shipping_proof_urls = parsePostgresArray(shippingInvoice.shipping_proof_urls);
  }

  const messages = await orderChatModel.getMessagesByOrderId(order.id);

  return { product, order, paymentInvoice, shippingInvoice, messages, isSeller, isHighestBidder };
}

export async function submitPayment(orderId, userId, { payment_method, payment_proof_urls, note, shipping_address, shipping_phone }) {
  const order = await orderModel.findById(orderId);
  if (!order || order.buyer_id !== userId) throw new Error('Unauthorized');

  await invoiceModel.createPaymentInvoice({ order_id: orderId, issuer_id: userId, payment_method, payment_proof_urls, note });
  await orderModel.updateShippingInfo(orderId, { shipping_address, shipping_phone });
  await orderModel.updateStatus(orderId, 'payment_submitted', userId);
}

export async function confirmPayment(orderId, userId) {
  const order = await orderModel.findById(orderId);
  if (!order || order.seller_id !== userId) throw new Error('Unauthorized');

  const paymentInvoice = await invoiceModel.getPaymentInvoice(orderId);
  if (!paymentInvoice) throw new Error('No payment invoice found');

  await invoiceModel.verifyInvoice(paymentInvoice.id);
  await orderModel.updateStatus(orderId, 'payment_confirmed', userId);
}

export async function submitShipping(orderId, userId, { tracking_number, shipping_provider, shipping_proof_urls, note }) {
  const order = await orderModel.findById(orderId);
  if (!order || order.seller_id !== userId) throw new Error('Unauthorized');

  await invoiceModel.createShippingInvoice({ order_id: orderId, issuer_id: userId, tracking_number, shipping_provider, shipping_proof_urls, note });
  await orderModel.updateStatus(orderId, 'shipped', userId);
}

export async function confirmDelivery(orderId, userId) {
  const order = await orderModel.findById(orderId);
  if (!order || order.buyer_id !== userId) throw new Error('Unauthorized');
  await orderModel.updateStatus(orderId, 'delivered', userId);
}

async function finalizeOrderIfBothReviewed(order, userId) {
  const buyerReview = await reviewModel.getProductReview(order.buyer_id, order.seller_id, order.product_id);
  const sellerReview = await reviewModel.getProductReview(order.seller_id, order.buyer_id, order.product_id);
  if (buyerReview && sellerReview) {
    await orderModel.updateStatus(order.id, 'completed', userId);
    await productModel.markAsSold(order.product_id);
  }
}

export async function submitRating(orderId, userId, { rating, comment }) {
  const order = await orderModel.findById(orderId);
  if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) throw new Error('Unauthorized');

  const isBuyer = order.buyer_id === userId;
  const reviewerId = userId;
  const revieweeId = isBuyer ? order.seller_id : order.buyer_id;
  const ratingValue = rating === 'positive' ? 1 : -1;

  const existingReview = await reviewModel.findByReviewerAndProduct(reviewerId, order.product_id);
  if (existingReview) {
    await reviewModel.updateByReviewerAndProduct(reviewerId, order.product_id, { rating: ratingValue, comment: comment || null });
  } else {
    await reviewModel.create({ reviewer_id: reviewerId, reviewed_user_id: revieweeId, product_id: order.product_id, rating: ratingValue, comment: comment || null });
  }

  await finalizeOrderIfBothReviewed(order, userId);
}

export async function completeTransaction(orderId, userId) {
  const order = await orderModel.findById(orderId);
  if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) throw new Error('Unauthorized');

  const isBuyer = order.buyer_id === userId;
  const reviewerId = userId;
  const revieweeId = isBuyer ? order.seller_id : order.buyer_id;

  const existingReview = await reviewModel.findByReviewerAndProduct(reviewerId, order.product_id);
  if (!existingReview) {
    await reviewModel.create({ reviewer_id: reviewerId, reviewed_user_id: revieweeId, product_id: order.product_id, rating: 0, comment: null });
  }

  await finalizeOrderIfBothReviewed(order, userId);
}

export async function sendMessage(orderId, userId, message) {
  const order = await orderModel.findById(orderId);
  if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) throw new Error('Unauthorized');
  await orderChatModel.sendMessage({ order_id: orderId, sender_id: userId, message });
}

export async function getMessagesHTML(orderId, userId) {
  const order = await orderModel.findById(orderId);
  if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) throw new Error('Unauthorized');

  const messages = await orderChatModel.getMessagesByOrderId(orderId);

  let messagesHtml = '';
  for (const msg of messages) {
    const isSent = msg.sender_id === userId;
    const msgDate = new Date(msg.created_at);
    const pad = n => String(n).padStart(2, '0');
    const formattedDate = `${pad(msgDate.getHours())}:${pad(msgDate.getMinutes())}:${pad(msgDate.getSeconds())} ${pad(msgDate.getDate())}/${pad(msgDate.getMonth() + 1)}/${msgDate.getFullYear()}`;

    messagesHtml += `
      <div class="chat-message ${isSent ? 'text-end' : ''}">
        <div class="chat-bubble ${isSent ? 'sent' : 'received'}">
          <div>${msg.message}</div>
          <div style="font-size: 0.7rem; margin-top: 3px; opacity: 0.8;">${formattedDate}</div>
        </div>
      </div>
    `;
  }

  return messagesHtml;
}

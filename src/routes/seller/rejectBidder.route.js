import express from 'express';
import * as productModel from '../../models/product.model.js';
import * as rejectedBidderModel from '../../models/rejectedBidder.model.js';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';
import { sendMail } from '../../utils/mailer.js';
import db from '../../utils/db.js';

const router = express.Router();

// ROUTE: REJECT BIDDER (POST) - Seller rejects a bidder from a product
router.post('/reject-bidder', isAuthenticated, async (req, res) => {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;

  try {
    let rejectedBidderInfo = null;
    let productInfo = null;
    let sellerInfo = null;

    // Use transaction to ensure data consistency
    await db.transaction(async (trx) => {
      // 1. Lock and verify product ownership
      const product = await trx('products')
        .where('id', productId)
        .forUpdate()
        .first();

      if (!product) {
        throw new Error('Product not found');
      }

      if (product.seller_id !== sellerId) {
        throw new Error('Only the seller can reject bidders');
      }

      // Check product status - only allow rejection for ACTIVE products
      const now = new Date();
      const endDate = new Date(product.end_at);
      
      if (product.is_sold !== null || endDate <= now || product.closed_at) {
        throw new Error('Can only reject bidders for active auctions');
      }

      // 2. Check if bidder has actually bid on this product
      const autoBid = await trx('auto_bidding')
        .where('product_id', productId)
        .where('bidder_id', bidderId)
        .first();

      if (!autoBid) {
        throw new Error('This bidder has not placed a bid on this product');
      }

      // Get bidder info for email notification
      rejectedBidderInfo = await trx('users')
        .where('id', bidderId)
        .first();
      
      productInfo = product;
      sellerInfo = await trx('users')
        .where('id', sellerId)
        .first();

      // 3. Add to rejected_bidders table
      await trx('rejected_bidders').insert({
        product_id: productId,
        bidder_id: bidderId,
        seller_id: sellerId
      }).onConflict(['product_id', 'bidder_id']).ignore();

      // 4. Remove all bidding history of this bidder for this product
      await trx('bidding_history')
        .where('product_id', productId)
        .where('bidder_id', bidderId)
        .del();

      // 5. Remove from auto_bidding
      await trx('auto_bidding')
        .where('product_id', productId)
        .where('bidder_id', bidderId)
        .del();

      // 6. Recalculate highest bidder and current price
      // Always check remaining bidders after rejection
      const allAutoBids = await trx('auto_bidding')
        .where('product_id', productId)
        .orderBy('max_price', 'desc');

      const bidderIdNum = parseInt(bidderId);
      const highestBidderIdNum = parseInt(product.highest_bidder_id);
      const wasHighestBidder = (highestBidderIdNum === bidderIdNum);

      if (allAutoBids.length === 0) {
        // No more bidders - reset to starting state
        await trx('products')
          .where('id', productId)
          .update({
            highest_bidder_id: null,
            current_price: product.starting_price,
            highest_max_price: null
          });
        // Don't add bidding history - no one actually bid
      } else if (allAutoBids.length === 1) {
        // Only one bidder left - they win at starting price (no competition)
        const winner = allAutoBids[0];
        const newPrice = product.starting_price;

        await trx('products')
          .where('id', productId)
          .update({
            highest_bidder_id: winner.bidder_id,
            current_price: newPrice,
            highest_max_price: winner.max_price
          });

        // Add history entry only if price changed
        if (wasHighestBidder || product.current_price !== newPrice) {
          await trx('bidding_history').insert({
            product_id: productId,
            bidder_id: winner.bidder_id,
            current_price: newPrice
          });
        }
      } else if (wasHighestBidder) {
        // Multiple bidders and rejected was highest - recalculate price
        const firstBidder = allAutoBids[0];
        const secondBidder = allAutoBids[1];
        
        // Current price should be minimum to beat second highest
        let newPrice = secondBidder.max_price + product.step_price;
        
        // But cannot exceed first bidder's max
        if (newPrice > firstBidder.max_price) {
          newPrice = firstBidder.max_price;
        }

        await trx('products')
          .where('id', productId)
          .update({
            highest_bidder_id: firstBidder.bidder_id,
            current_price: newPrice,
            highest_max_price: firstBidder.max_price
          });

        // Add history entry only if price changed
        const lastHistory = await trx('bidding_history')
          .where('product_id', productId)
          .orderBy('created_at', 'desc')
          .first();

        if (!lastHistory || lastHistory.current_price !== newPrice) {
          await trx('bidding_history').insert({
            product_id: productId,
            bidder_id: firstBidder.bidder_id,
            current_price: newPrice
          });
        }
      }
      // If rejected bidder was NOT the highest bidder and still multiple bidders left, 
      // don't update anything - just removing them from auto_bidding is enough
    });

    // Send email notification to rejected bidder (outside transaction) - asynchronously
    if (rejectedBidderInfo && rejectedBidderInfo.email && productInfo) {
      // Don't await - send email in background
      sendMail({
        to: rejectedBidderInfo.email,
        subject: `Your bid has been rejected: ${productInfo.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Bid Rejected</h1>
            </div>
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p>Dear <strong>${rejectedBidderInfo.fullname}</strong>,</p>
              <p>We regret to inform you that the seller has rejected your bid on the following product:</p>
              <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #dc3545;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${productInfo.name}</h3>
                <p style="margin: 5px 0; color: #666;"><strong>Seller:</strong> ${sellerInfo ? sellerInfo.fullname : 'N/A'}</p>
              </div>
              <p style="color: #666;">This means you can no longer place bids on this specific product. Your previous bids on this product have been removed.</p>
              <p style="color: #666;">You can still participate in other auctions on our platform.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${req.protocol}://${req.get('host')}/" style="display: inline-block; background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Browse Other Auctions
                </a>
              </div>
              <p style="color: #888; font-size: 13px;">If you believe this was done in error, please contact our support team.</p>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; text-align: center;">This is an automated message from Online Auction. Please do not reply to this email.</p>
          </div>
        `
      }).then(() => {
        console.log(`Rejection email sent to ${rejectedBidderInfo.email} for product #${productId}`);
      }).catch((emailError) => {
        console.error('Failed to send rejection email:', emailError);
      });
    }

    res.json({ success: true, message: 'Bidder rejected successfully' });
  } catch (error) {
    console.error('Error rejecting bidder:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to reject bidder' 
    });
  }
});

// ROUTE: UNREJECT BIDDER (POST) - Seller removes a bidder from rejected list
router.post('/unreject-bidder', isAuthenticated, async (req, res) => {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;

  try {
    // Verify product ownership
    const product = await productModel.findByProductId2(productId, sellerId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    if (product.seller_id !== sellerId) {
      throw new Error('Only the seller can unreject bidders');
    }

    // Check product status - only allow unrejection for ACTIVE products
    const now = new Date();
    const endDate = new Date(product.end_at);
    
    if (product.is_sold !== null || endDate <= now || product.closed_at) {
      throw new Error('Can only unreject bidders for active auctions');
    }

    // Remove from rejected_bidders table
    await rejectedBidderModel.unrejectBidder(productId, bidderId);

    res.json({ success: true, message: 'Bidder can now bid on this product again' });
  } catch (error) {
    console.error('Error unrejecting bidder:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to unreject bidder' 
    });
  }
});

export default router;

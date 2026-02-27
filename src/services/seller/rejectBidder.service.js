import db from '../../utils/db.js';
import * as productModel from '../../models/product.model.js';
import * as rejectedBidderModel from '../../models/rejectedBidder.model.js';
import * as autoBiddingModel from '../../models/autoBidding.model.js';
import * as biddingHistoryModel from '../../models/biddingHistory.model.js';
import * as userModel from '../../models/user.model.js';
import { sendMail } from '../../utils/mailer.js';

// encapsulates entire rejection process + notification
export async function rejectBidder(
  sellerId,
  productId,
  bidderId,
  notifyOptions = { protocol: null, host: null }
) {
  let rejectedBidderInfo = null;
  let productInfo = null;
  let sellerInfo = null;

  await db.transaction(async (trx) => {
    const product = await productModel.findForUpdate(productId, trx);

    if (!product) {
      throw new Error('Product not found');
    }
    if (product.seller_id !== sellerId) {
      throw new Error('Only the seller can reject bidders');
    }

    const now = new Date();
    const endDate = new Date(product.end_at);
    if (product.is_sold !== null || endDate <= now || product.closed_at) {
      throw new Error('Can only reject bidders for active auctions');
    }

    const autoBid = await autoBiddingModel.getAutoBid(productId, bidderId, trx);

    if (!autoBid) {
      throw new Error('This bidder has not placed a bid on this product');
    }

    rejectedBidderInfo = await userModel.findById(bidderId, trx);

    productInfo = product;
    sellerInfo = await userModel.findById(sellerId, trx);

    await rejectedBidderModel.rejectBidder(productId, bidderId, sellerId, trx);

    await biddingHistoryModel.deleteByProductAndBidder(productId, bidderId, trx);

    await autoBiddingModel.deleteAutoBid(productId, bidderId, trx);

    const allAutoBids = await autoBiddingModel.getAllAutoBids(productId, trx);

    const bidderIdNum = parseInt(bidderId);
    const highestBidderIdNum = parseInt(product.highest_bidder_id);
    const wasHighestBidder = highestBidderIdNum === bidderIdNum;

    if (allAutoBids.length === 0) {
      await productModel.updateProductData(productId, {
        highest_bidder_id: null,
        current_price: product.starting_price,
        highest_max_price: null,
      }, trx);
    } else if (allAutoBids.length === 1) {
      const winner = allAutoBids[0];
      const newPrice = product.starting_price;

      await productModel.updateProductData(productId, {
        highest_bidder_id: winner.bidder_id,
        current_price: newPrice,
        highest_max_price: winner.max_price,
      }, trx);

      if (wasHighestBidder || product.current_price !== newPrice) {
        await biddingHistoryModel.createBid(productId, winner.bidder_id, newPrice, trx);
      }
    } else if (wasHighestBidder) {
      const firstBidder = allAutoBids[0];
      const secondBidder = allAutoBids[1];

      let newPrice = secondBidder.max_price + product.step_price;
      if (newPrice > firstBidder.max_price) {
        newPrice = firstBidder.max_price;
      }

      await productModel.updateProductData(productId, {
        highest_bidder_id: firstBidder.bidder_id,
        current_price: newPrice,
        highest_max_price: firstBidder.max_price,
      }, trx);

      const lastHistory = await biddingHistoryModel.getLastByProduct(productId, trx);

      if (!lastHistory || lastHistory.current_price !== newPrice) {
        await biddingHistoryModel.createBid(productId, firstBidder.bidder_id, newPrice, trx);
      }
    }
  });

  // email notification
  if (rejectedBidderInfo && rejectedBidderInfo.email && productInfo) {
    const productUrl =
      notifyOptions.protocol && notifyOptions.host
        ? `${notifyOptions.protocol}://${notifyOptions.host}/`
        : `${process.env.BASE_URL || ''}/`;
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
                <p style="margin: 5px 0; color: #666;"><strong>Seller:</strong> ${
        sellerInfo ? sellerInfo.fullname : 'N/A'
      }</p>
              </div>
              <p style="color: #666;">This means you can no longer place bids on this specific product. Your previous bids on this product have been removed.</p>
              <p style="color: #666;">You can still participate in other auctions on our platform.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${productUrl}" style="display: inline-block; background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Browse Other Auctions
                </a>
              </div>
              <p style="color: #888; font-size: 13px;">If you believe this was done in error, please contact our support team.</p>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; text-align: center;">This is an automated message from Online Auction. Please do not reply to this email.</p>
          </div>
        `,
    })
      .then(() => {
        console.log(`Rejection email sent to ${rejectedBidderInfo.email} for product #${productId}`);
      })
      .catch((emailError) => {
        console.error('Failed to send rejection email:', emailError);
      });
  }
}

export async function unrejectBidder(sellerId, productId, bidderId) {
  const product = await productModel.findByProductId2(productId, sellerId);
  if (!product) {
    throw new Error('Product not found');
  }
  if (product.seller_id !== sellerId) {
    throw new Error('Only the seller can unreject bidders');
  }
  const now = new Date();
  const endDate = new Date(product.end_at);
  if (product.is_sold !== null || endDate <= now || product.closed_at) {
    throw new Error('Can only unreject bidders for active auctions');
  }
  await rejectedBidderModel.unrejectBidder(productId, bidderId);
}

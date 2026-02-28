import { 
  reviewModel, 
  userModel, 
  watchlistModel as watchListModel, 
  systemSettingModel, 
  productModel, 
  biddingHistoryModel, 
  autoBiddingModel, 
  rejectedBidderModel, 
  transaction 
} from '../../models/index.js';
import { sendMail } from '../../utils/mailer.js';

export async function addToWatchlist(userId, productId) {
  const isInWatchlist = await watchListModel.isInWatchlist(userId, productId);
  if (!isInWatchlist) {
    await watchListModel.addToWatchlist(userId, productId);
  }
}

export async function removeFromWatchlist(userId, productId) {
  await watchListModel.removeFromWatchlist(userId, productId);
}

export async function placeBid(userId, productId, bidAmount, productUrl) {
  const result = await transaction(async (trx) => {
    const product = await productModel.findForUpdate(productId, trx);

    if (!product) throw new Error('Product not found');

    const previousHighestBidderId = product.highest_bidder_id;
    const previousPrice = parseFloat(product.current_price || product.starting_price);

    if (product.is_sold === true) throw new Error('This product has already been sold');
    if (product.seller_id === userId) throw new Error('You cannot bid on your own product');

    const isRejected = await rejectedBidderModel.isRejected(productId, userId, trx);
    if (isRejected) throw new Error('You have been rejected from bidding on this product by the seller');

    const ratingPoint = await reviewModel.calculateRatingPoint(userId);
    const userReviews = await reviewModel.getReviewsByUserId(userId);
    const hasReviews = userReviews.length > 0;

    if (!hasReviews) {
      if (!product.allow_unrated_bidder) throw new Error('This seller does not allow unrated bidders to bid on this product.');
    } else if (ratingPoint.rating_point <= 0) {
      throw new Error('You are not eligible to place bids due to your rating.');
    } else if (ratingPoint.rating_point <= 0.8) {
      throw new Error('Your rating point is not greater than 80%. You cannot place bids.');
    }

    const now = new Date();
    const endDate = new Date(product.end_at);
    if (now > endDate) throw new Error('Auction has ended');

    const currentPrice = parseFloat(product.current_price || product.starting_price);
    if (bidAmount <= currentPrice) throw new Error(`Bid must be higher than current price (${currentPrice.toLocaleString()} VND)`);

    const minIncrement = parseFloat(product.step_price);
    if (bidAmount < currentPrice + minIncrement) throw new Error(`Bid must be at least ${minIncrement.toLocaleString()} VND higher than current price`);

    // Auto-extend logic
    let extendedEndTime = null;
    if (product.auto_extend) {
      const settings = await systemSettingModel.getSettings();
      const endTime = new Date(product.end_at);
      const minutesRemaining = (endTime - now) / (1000 * 60);
      if (minutesRemaining <= settings?.auto_extend_trigger_minutes) {
        extendedEndTime = new Date(endTime.getTime() + settings.auto_extend_duration_minutes * 60 * 1000);
        product.end_at = extendedEndTime;
      }
    }

    // Automatic bidding calculation
    let newCurrentPrice, newHighestBidderId, newHighestMaxPrice;
    let shouldCreateHistory = true;
    const buyNowPrice = product.buy_now_price ? parseFloat(product.buy_now_price) : null;
    let buyNowTriggered = false;

    if (buyNowPrice && product.highest_bidder_id && product.highest_max_price && product.highest_bidder_id !== userId) {
      const currentHighestMaxPrice = parseFloat(product.highest_max_price);
      if (currentHighestMaxPrice >= buyNowPrice) {
        newCurrentPrice = buyNowPrice;
        newHighestBidderId = product.highest_bidder_id;
        newHighestMaxPrice = currentHighestMaxPrice;
        buyNowTriggered = true;
      }
    }

    if (!buyNowTriggered) {
      if (product.highest_bidder_id === userId) {
        newCurrentPrice = parseFloat(product.current_price || product.starting_price);
        newHighestBidderId = userId;
        newHighestMaxPrice = bidAmount;
        shouldCreateHistory = false;
      } else if (!product.highest_bidder_id || !product.highest_max_price) {
        newCurrentPrice = product.starting_price;
        newHighestBidderId = userId;
        newHighestMaxPrice = bidAmount;
      } else {
        const currentHighestMaxPrice = parseFloat(product.highest_max_price);
        const currentHighestBidderId = product.highest_bidder_id;
        if (bidAmount < currentHighestMaxPrice) {
          newCurrentPrice = bidAmount;
          newHighestBidderId = currentHighestBidderId;
          newHighestMaxPrice = currentHighestMaxPrice;
        } else if (bidAmount === currentHighestMaxPrice) {
          newCurrentPrice = bidAmount;
          newHighestBidderId = currentHighestBidderId;
          newHighestMaxPrice = currentHighestMaxPrice;
        } else {
          newCurrentPrice = currentHighestMaxPrice + minIncrement;
          newHighestBidderId = userId;
          newHighestMaxPrice = bidAmount;
        }
      }
      if (buyNowPrice && newCurrentPrice >= buyNowPrice) {
        newCurrentPrice = buyNowPrice;
        buyNowTriggered = true;
      }
    }

    const updateData = { current_price: newCurrentPrice, highest_bidder_id: newHighestBidderId, highest_max_price: newHighestMaxPrice };
    if (buyNowTriggered) {
      updateData.end_at = new Date();
      updateData.closed_at = new Date();
    } else if (extendedEndTime) {
      updateData.end_at = extendedEndTime;
    }

    await productModel.updateProductData(productId, updateData, trx);

    if (shouldCreateHistory) {
      await biddingHistoryModel.createBid(productId, newHighestBidderId, newCurrentPrice, trx);
    }

    await autoBiddingModel.upsertAutoBid(productId, userId, bidAmount, trx);

    return {
      newCurrentPrice, newHighestBidderId, userId, bidAmount,
      productSold: buyNowTriggered,
      autoExtended: !!extendedEndTime,
      newEndTime: extendedEndTime,
      productName: product.name,
      sellerId: product.seller_id,
      previousHighestBidderId,
      previousPrice,
      priceChanged: previousPrice !== newCurrentPrice,
    };
  });

  // Fire-and-forget email notifications
  (async () => {
    try {
      const [seller, currentBidder, previousBidder] = await Promise.all([
        userModel.findById(result.sellerId),
        userModel.findById(result.userId),
        result.previousHighestBidderId && result.previousHighestBidderId !== result.userId
          ? userModel.findById(result.previousHighestBidderId) : null,
      ]);

      const emailPromises = [];

      if (seller?.email) {
        emailPromises.push(sendMail({
          to: seller.email,
          subject: `💰 New bid on your product: ${result.productName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">New Bid Received!</h1>
              </div>
              <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <p>Dear <strong>${seller.fullname}</strong>,</p>
                <p>Your product <strong>${result.productName}</strong> received a new bid.</p>
                <p><strong>Current Price:</strong> ${new Intl.NumberFormat('en-US').format(result.newCurrentPrice)} VND</p>
                ${result.productSold ? '<p><strong>🎉 Buy Now price reached! Auction has ended.</strong></p>' : ''}
                <a href="${productUrl}" style="display: inline-block; background: #72AEC8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">View Product</a>
              </div>
            </div>
          `,
        }));
      }

      if (currentBidder?.email) {
        const isWinning = result.newHighestBidderId === result.userId;
        emailPromises.push(sendMail({
          to: currentBidder.email,
          subject: isWinning ? `✅ You're winning: ${result.productName}` : `📊 Bid placed: ${result.productName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <p>Dear <strong>${currentBidder.fullname}</strong>,</p>
              <p>${isWinning ? 'You are currently the highest bidder!' : 'Your bid was placed but another bidder has a higher maximum bid.'}</p>
              <p><strong>Product:</strong> ${result.productName}</p>
              <p><strong>Current Price:</strong> ${new Intl.NumberFormat('en-US').format(result.newCurrentPrice)} VND</p>
              ${result.productSold && isWinning ? '<p><strong>🎉 You won this product! Please proceed to payment.</strong></p>' : ''}
              <a href="${productUrl}" style="display: inline-block; background: #72AEC8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">View Auction</a>
            </div>
          `,
        }));
      }

      if (previousBidder?.email && result.priceChanged) {
        const wasOutbid = result.newHighestBidderId !== result.previousHighestBidderId;
        emailPromises.push(sendMail({
          to: previousBidder.email,
          subject: wasOutbid ? `⚠️ You've been outbid: ${result.productName}` : `📊 Price updated: ${result.productName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <p>Dear <strong>${previousBidder.fullname}</strong>,</p>
              <p>${wasOutbid ? 'Another bidder has surpassed your bid.' : "You're still the highest bidder, but the price has been updated."}</p>
              <p><strong>Product:</strong> ${result.productName}</p>
              <p><strong>New Current Price:</strong> ${new Intl.NumberFormat('en-US').format(result.newCurrentPrice)} VND</p>
              <a href="${productUrl}" style="display: inline-block; background: #72AEC8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">
                ${wasOutbid ? 'Place New Bid' : 'View Auction'}
              </a>
            </div>
          `,
        }));
      }

      if (emailPromises.length > 0) await Promise.all(emailPromises);
    } catch (err) {
      console.error('Bid notification email error:', err);
    }
  })();

  return result;
}

export async function buyNow(userId, productId) {
  await transaction(async (trx) => {
    const product = await productModel.findForUpdate(productId, trx);

    if (!product) throw new Error('Product not found');
    if (product.seller_id === userId) throw new Error('Seller cannot buy their own product');

    const now = new Date();
    const endDate = new Date(product.end_at);
    if (product.is_sold !== null) throw new Error('Product is no longer available');
    if (endDate <= now || product.closed_at) throw new Error('Auction has already ended');
    if (!product.buy_now_price) throw new Error('Buy Now option is not available for this product');

    const isRejected = await rejectedBidderModel.isRejected(productId, userId, trx);
    if (isRejected) throw new Error('You have been rejected from bidding on this product');

    if (!product.allow_unrated_bidder) {
      const ratingData = await reviewModel.calculateRatingPoint(userId);
      if (!ratingData || ratingData.rating_point === 0) {
        throw new Error('This product does not allow bidders without ratings');
      }
    }

    const buyNowPrice = parseFloat(product.buy_now_price);
    await productModel.updateProductData(productId, {
      current_price: buyNowPrice,
      highest_bidder_id: userId,
      highest_max_price: buyNowPrice,
      end_at: now,
      closed_at: now,
      is_buy_now_purchase: true,
    }, trx);

    await biddingHistoryModel.createBid(productId, userId, buyNowPrice, trx, { isBuyNow: true });
  });
}

export function buildBidSuccessMessage(result) {
  let message = '';
  if (result.productSold) {
    message = result.newHighestBidderId === result.userId
      ? `Congratulations! You won the product with Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND. Please proceed to payment.`
      : `Product has been sold to another bidder at Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND.`;
  } else if (result.newHighestBidderId === result.userId) {
    message = `Bid placed successfully! Current price: ${result.newCurrentPrice.toLocaleString()} VND (Your max: ${result.bidAmount.toLocaleString()} VND)`;
  } else {
    message = `Bid placed! Another bidder is currently winning at ${result.newCurrentPrice.toLocaleString()} VND`;
  }

  if (result.autoExtended) {
    message += ` | Auction extended to ${new Date(result.newEndTime).toLocaleString('vi-VN')}`;
  }

  return message;
}

import { productModel, reviewModel, productDescUpdateModel, biddingHistoryModel, productCommentModel } from '../../models/index.js';
import { moveProductImages } from '../../utils/productImageHelper.js';

// listing helpers
export function getAllProducts(sellerId) {
  return productModel.findAllProductsBySellerId(sellerId);
}

export function getActiveProducts(sellerId) {
  return productModel.findActiveProductsBySellerId(sellerId);
}

export async function getPendingProducts(sellerId) {
  const [products, stats] = await Promise.all([
    productModel.findPendingProductsBySellerId(sellerId),
    productModel.getPendingProductsStats(sellerId),
  ]);
  return { products, stats };
}

export async function getSoldProducts(sellerId) {
  const [products, stats] = await Promise.all([
    productModel.findSoldProductsBySellerId(sellerId),
    productModel.getSoldProductsStats(sellerId),
  ]);

  const productsWithReview = await Promise.all(
    products.map(async (product) => {
      const review = await reviewModel.getProductReview(
        sellerId,
        product.highest_bidder_id,
        product.id
      );
      const hasActualReview = review && review.rating !== 0;
      return {
        ...product,
        hasReview: hasActualReview,
        reviewRating: hasActualReview
          ? review.rating === 1
            ? 'positive'
            : 'negative'
          : null,
        reviewComment: hasActualReview ? review.comment : '',
      };
    })
  );

  return { products: productsWithReview, stats };
}

export async function getExpiredProducts(sellerId) {
  const products = await productModel.findExpiredProductsBySellerId(sellerId);

  for (let product of products) {
    if (product.status === 'Cancelled' && product.highest_bidder_id) {
      const review = await reviewModel.getProductReview(
        sellerId,
        product.highest_bidder_id,
        product.id
      );
      const hasActualReview = review && review.rating !== 0;
      product.hasReview = hasActualReview;
      if (hasActualReview) {
        product.reviewRating = review.rating === 1 ? 'positive' : 'negative';
        product.reviewComment = review.comment;
      }
    }
  }

  return products;
}

// add / modify operations
export async function addProduct(sellerId, product, imgsList) {
  const returnedID = await productModel.addProduct({
    seller_id: sellerId,
    category_id: product.category_id,
    name: product.name,
    starting_price: product.start_price.replace(/,/g, ''),
    step_price: product.step_price.replace(/,/g, ''),
    buy_now_price:
      product.buy_now_price !== ''
        ? product.buy_now_price.replace(/,/g, '')
        : null,
    created_at: new Date(product.created_at),
    end_at: new Date(product.end_date),
    auto_extend: product.auto_extend === '1',
    thumbnail: null,
    description: product.description,
    highest_bidder_id: null,
    current_price: product.start_price.replace(/,/g, ''),
    is_sold: null,
    allow_unrated_bidder: product.allow_new_bidders === '1',
    closed_at: null,
  });

  const newId = returnedID[0].id || returnedID[0];

  const { thumbnailPath, imagePaths } = await moveProductImages(
    newId,
    product.thumbnail,
    imgsList
  );
  if (thumbnailPath) await productModel.updateProductThumbnail(newId, thumbnailPath);
  if (imagePaths.length) await productModel.addProductImages(imagePaths);

  return newId;
}

export async function cancelProduct(
  sellerId,
  productId,
  reason,
  highest_bidder_id
) {
  const product = await productModel.cancelProduct(productId, sellerId);
  if (highest_bidder_id) {
    await reviewModel.createReview({
      reviewer_id: sellerId,
      reviewee_id: highest_bidder_id,
      product_id: productId,
      rating: -1,
      comment: reason || 'Auction cancelled by seller',
    });
  }
  return product;
}

export async function appendDescription(
  sellerId,
  productId,
  description,
  notifyOptions = { protocol: null, host: null }
) {
  if (!description || description.trim() === '') {
    throw new Error('Description is required');
  }

  const product = await productModel.findByProductId2(productId, null);
  if (!product) {
    throw new Error('Product not found');
  }
  if (product.seller_id !== sellerId) {
    throw new Error('Unauthorized');
  }

  await productDescUpdateModel.addUpdate(productId, description.trim());

  const [bidders, commenters] = await Promise.all([
    biddingHistoryModel.getUniqueBidders(productId),
    productCommentModel.getUniqueCommenters(productId),
  ]);

  const notifyMap = new Map();
  [...bidders, ...commenters].forEach((user) => {
    if (user.id !== sellerId && !notifyMap.has(user.email)) {
      notifyMap.set(user.email, user);
    }
  });

  const notifyUsers = Array.from(notifyMap.values());
  if (notifyUsers.length > 0) {
    const productUrl =
      notifyOptions.protocol && notifyOptions.host
        ? `${notifyOptions.protocol}://${notifyOptions.host}/products/detail?id=${productId}`
        : `${process.env.BASE_URL || ''}/products/detail?id=${productId}`;

    Promise.all(
      notifyUsers.map((user) =>
        sendMail({
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
                                    <p style="margin: 0; color: #666;">Current Price: <strong style="color: #72AEC8;">${new Intl.NumberFormat('en-US').format(
                                      product.current_price
                                    )} VND</strong></p>
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
        }).catch((err) => console.error('Failed to send email to', user.email, err))
      )
    ).catch((err) => console.error('Email notification error:', err));
  }
}

export async function getDescriptionUpdates(sellerId, productId) {
  const product = await productModel.findByProductId2(productId, null);
  if (!product) {
    throw new Error('Product not found');
  }
  if (product.seller_id !== sellerId) {
    throw new Error('Unauthorized');
  }
  return productDescUpdateModel.findByProductId(productId);
}

export async function updateDescriptionUpdate(
  sellerId,
  updateId,
  content
) {
  if (!content || content.trim() === '') {
    throw new Error('Content is required');
  }
  const update = await productDescUpdateModel.findById(updateId);
  if (!update) {
    throw new Error('Update not found');
  }
  const product = await productModel.findByProductId2(update.product_id, null);
  if (!product || product.seller_id !== sellerId) {
    throw new Error('Unauthorized');
  }
  await productDescUpdateModel.updateContent(updateId, content.trim());
}

export async function deleteDescriptionUpdate(sellerId, updateId) {
  const update = await productDescUpdateModel.findById(updateId);
  if (!update) {
    throw new Error('Update not found');
  }
  const product = await productModel.findByProductId2(update.product_id, null);
  if (!product || product.seller_id !== sellerId) {
    throw new Error('Unauthorized');
  }
  await productDescUpdateModel.deleteUpdate(updateId);
}

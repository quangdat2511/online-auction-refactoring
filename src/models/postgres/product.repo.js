import db from '../../utils/db.js';
import { PAGINATION } from '../../config/app.config.js';

// ── Internal Query Helpers ────────────────────────────────

/** Returns a subquery that counts bids for the current product row. */
const bidCountRaw = () =>
  db.raw(`(SELECT COUNT(*) FROM bidding_history WHERE bidding_history.product_id = products.id) AS bid_count`);

/** Returns a raw expression that masks the highest bidder's full name. */
const maskedBidderRaw = () =>
  db.raw(`mask_name_alternating(users.fullname) AS bidder_name`);

/**
 * Base query for the top-products home-page sections.
 * Joins the highest-bidder user, selects masked bidder name + bid count,
 * and applies the global TOP_PRODUCTS_LIMIT.
 */
function topProductsQuery() {
  return db('products')
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .select('products.*', maskedBidderRaw(), bidCountRaw())
    .limit(PAGINATION.TOP_PRODUCTS_LIMIT);
}

/**
 * Base query for seller-dashboard product listing functions.
 * Joins categories, pre-filters by seller_id, and selects
 * products.*, category name, and bid_count.
 */
function sellerProductBaseQuery(sellerId) {
  return db('products')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('seller_id', sellerId)
    .select('products.*', 'categories.name as category_name', bidCountRaw());
}

// ─────────────────────────────────────────────────────────

export function findAll() {
  return db('products')
    .leftJoin('users as bidder', 'products.highest_bidder_id', 'bidder.id')
    .leftJoin('users as seller', 'products.seller_id', 'seller.id')
    .select(
      'products.*', 'seller.fullname as seller_name', 'bidder.fullname as highest_bidder_name',
      bidCountRaw()
    );
}

export async function findByProductIdForAdmin(productId, userId) {
  const rows = await db('products')
    .leftJoin('users as bidder', 'products.highest_bidder_id', 'bidder.id')
    .leftJoin('users as seller', 'products.seller_id', 'seller.id')
    .leftJoin('product_images', 'products.id', 'product_images.product_id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .leftJoin('watchlists', function() {
        this.on('products.id', '=', 'watchlists.product_id')
            .andOnVal('watchlists.user_id', '=', userId || -1); 
    })
    .where('products.id', productId)
    .select(
      'products.*',
      'product_images.img_link',
      'bidder.fullname as highest_bidder_name',
      'seller.fullname as seller_name',
      'categories.name as category_name',
      bidCountRaw(),
      db.raw('watchlists.product_id IS NOT NULL AS is_favorite')
    );

  if (rows.length === 0) return null;

  const product = rows[0];
  product.sub_images = rows
    .map(row => row.img_link)
    .filter(link => link && link !== product.thumbnail);

  return product;
}

export function findPage(limit, offset) {
  return db('products')
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .select('products.*', maskedBidderRaw(), bidCountRaw())
    .limit(limit).offset(offset);
}

// 1. Hàm tìm kiếm phân trang (Simplified FTS - Search in product name and category)
export function searchPageByKeywords(keywords, limit, offset, userId, logic = 'or', sort = '') {
  // Remove accents from keywords for search
  const searchQuery = keywords.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/đ/g, 'd').replace(/Đ/g, 'D'); // Vietnamese d
  
  let query = db('products')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .leftJoin('categories as parent_category', 'categories.parent_id', 'parent_category.id')
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .leftJoin('watchlists', function() {
      this.on('products.id', '=', 'watchlists.product_id')
        .andOnVal('watchlists.user_id', '=', userId || -1);
    })
    // Chỉ hiển thị sản phẩm ACTIVE
    .where('products.end_at', '>', new Date())
    .whereNull('products.closed_at')
    .where((builder) => {
      const words = searchQuery.split(/\s+/).filter(w => w.length > 0);
      if (logic === 'and') {
        words.forEach(word => {
          builder.where(function() {
            this.whereRaw(`LOWER(remove_accents(products.name)) LIKE ?`, [`%${word}%`])
              .orWhereRaw(`LOWER(remove_accents(categories.name)) LIKE ?`, [`%${word}%`])
              .orWhereRaw(`LOWER(remove_accents(parent_category.name)) LIKE ?`, [`%${word}%`]);
          });
        });
      } else {
        words.forEach(word => {
          builder.orWhere(function() {
            this.whereRaw(`LOWER(remove_accents(products.name)) LIKE ?`, [`%${word}%`])
              .orWhereRaw(`LOWER(remove_accents(categories.name)) LIKE ?`, [`%${word}%`])
              .orWhereRaw(`LOWER(remove_accents(parent_category.name)) LIKE ?`, [`%${word}%`]);
          });
        });
      }
    })
    .select(
      'products.*',
      'categories.name as category_name',
      maskedBidderRaw(),
      bidCountRaw(),
      db.raw('watchlists.product_id IS NOT NULL AS is_favorite')
    );

  // Apply sorting
  if (sort === 'price_asc') {
    query = query.orderBy('products.current_price', 'asc');
  } else if (sort === 'price_desc') {
    query = query.orderBy('products.current_price', 'desc');
  } else if (sort === 'newest') {
    query = query.orderBy('products.created_at', 'desc');
  } else if (sort === 'oldest') {
    query = query.orderBy('products.created_at', 'asc');
  } else {
    query = query.orderBy('products.end_at', 'asc');
  }

  return query.limit(limit).offset(offset);
}

// 2. Hàm đếm tổng số lượng (Simplified)
export function countByKeywords(keywords, logic = 'or') {
  const searchQuery = keywords.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
  
  return db('products')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .leftJoin('categories as parent_category', 'categories.parent_id', 'parent_category.id')
    .where('products.end_at', '>', new Date())
    .whereNull('products.closed_at')
    .where((builder) => {
      const words = searchQuery.split(/\s+/).filter(w => w.length > 0);
      if (logic === 'and') {
        words.forEach(word => {
          builder.where(function() {
            this.whereRaw(`LOWER(remove_accents(products.name)) LIKE ?`, [`%${word}%`])
              .orWhereRaw(`LOWER(remove_accents(categories.name)) LIKE ?`, [`%${word}%`])
              .orWhereRaw(`LOWER(remove_accents(parent_category.name)) LIKE ?`, [`%${word}%`]);
          });
        });
      } else {
        words.forEach(word => {
          builder.orWhere(function() {
            this.whereRaw(`LOWER(remove_accents(products.name)) LIKE ?`, [`%${word}%`])
              .orWhereRaw(`LOWER(remove_accents(categories.name)) LIKE ?`, [`%${word}%`])
              .orWhereRaw(`LOWER(remove_accents(parent_category.name)) LIKE ?`, [`%${word}%`]);
          });
        });
      }
    })
    .count('products.id as count')
    .first();
}
export function countAll() {
  return db('products').count('id as count').first();
}

export function findByCategoryId(categoryId, limit, offset, sort, currentUserId) {
  return db('products')
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .leftJoin('watchlists', function() {
      this.on('products.id', '=', 'watchlists.product_id')
        .andOnVal('watchlists.user_id', '=', currentUserId || -1); 
    })
    .where('products.category_id', categoryId)
    .where('products.end_at', '>', new Date())
    .whereNull('products.closed_at')
    .select(
      'products.*',
      maskedBidderRaw(),
      bidCountRaw(),
      db.raw('watchlists.product_id IS NOT NULL AS is_favorite')
    )
    .modify((queryBuilder) => {
      if (sort === 'price_asc') {
        queryBuilder.orderBy('products.current_price', 'asc');
      }
      else if (sort === 'price_desc') {
        queryBuilder.orderBy('products.current_price', 'desc');
      }
      else if (sort === 'newest') {
        queryBuilder.orderBy('products.created_at', 'desc');
      }
      else if (sort === 'oldest') {
        queryBuilder.orderBy('products.created_at', 'asc');
      }
      else {
        queryBuilder.orderBy('products.created_at', 'desc');
      }
    })
    .limit(limit)
    .offset(offset);
}

export function countByCategoryId(categoryId) {
  return db('products')
    .where('category_id', categoryId)
    .count('id as count')
    .first();
}

export function findByCategoryIds(categoryIds, limit, offset, sort, currentUserId) {
  return db('products')
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .leftJoin('watchlists', function() {
      this.on('products.id', '=', 'watchlists.product_id')
        .andOnVal('watchlists.user_id', '=', currentUserId || -1);
    })
    .whereIn('products.category_id', categoryIds)
    .where('products.end_at', '>', new Date())
    .whereNull('products.closed_at')
    .select(
      'products.*',
      maskedBidderRaw(),
      bidCountRaw(),
      db.raw('watchlists.product_id IS NOT NULL AS is_favorite')
    )
    .modify((queryBuilder) => {
      if (sort === 'price_asc') {
        queryBuilder.orderBy('products.current_price', 'asc');
      }
      else if (sort === 'price_desc') {
        queryBuilder.orderBy('products.current_price', 'desc');
      }
      else if (sort === 'newest') {
        queryBuilder.orderBy('products.created_at', 'desc');
      }
      else if (sort === 'oldest') {
        queryBuilder.orderBy('products.created_at', 'asc');
      }
      else {
        queryBuilder.orderBy('products.created_at', 'desc');
      }
    })
    .limit(limit)
    .offset(offset);
}

export function countByCategoryIds(categoryIds) {
  return db('products')
    .whereIn('category_id', categoryIds)
    .where('end_at', '>', new Date())
    .whereNull('closed_at')
    .count('id as count')
    .first();
}

export function findTopEnding() {
  return topProductsQuery()
    .where('products.end_at', '>', new Date())
    .whereNull('products.closed_at')
    .orderBy('end_at', 'asc');
}

export function findTopPrice() {
  return topProductsQuery()
    .where('products.end_at', '>', new Date())
    .whereNull('products.closed_at')
    .orderBy('current_price', 'desc');
}

export function findTopBids() {
  return topProductsQuery()
    .where('products.end_at', '>', new Date())
    .whereNull('products.closed_at')
    .orderBy('bid_count', 'desc');
}

export function findByProductId(productId) {
  return db('products')
    .leftJoin('users as highest_bidder', 'products.highest_bidder_id', 'highest_bidder.id')
    .leftJoin('product_images', 'products.id', 'product_images.product_id')
    .leftJoin('users as seller', 'products.seller_id', 'seller.id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('products.id', productId)
    .select(
      'products.*',
      'product_images.img_link',
      'seller.fullname as seller_name',
      'seller.created_at as seller_created_at',
      'categories.name as category_name',
      db.raw(`mask_name_alternating(highest_bidder.fullname) AS bidder_name`),
      bidCountRaw()
    )
}

export function findRelatedProducts(productId) {
    return db('products')
      .leftJoin('products as p2', 'products.category_id', 'p2.category_id')
      .where('products.id', productId)
      .andWhere('p2.id', '!=', productId)
      .select('p2.*')
      .limit(5);
  } 

export async function findByProductId2(productId, userId) {
  const rows = await db('products')
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .leftJoin('product_images', 'products.id', 'product_images.product_id')
    .leftJoin('watchlists', function() {
        this.on('products.id', '=', 'watchlists.product_id')
            .andOnVal('watchlists.user_id', '=', userId || -1); 
    })
    .leftJoin('users as seller', 'products.seller_id', 'seller.id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('products.id', productId)
    .select(
      'products.*',
      'product_images.img_link',
      'seller.fullname as seller_name',
      'seller.email as seller_email',
      'seller.created_at as seller_created_at',
      'categories.name as category_name',
      maskedBidderRaw(),
      'users.fullname as highest_bidder_name',
      'users.email as highest_bidder_email',
      bidCountRaw(),
      db.raw('watchlists.product_id IS NOT NULL AS is_favorite')
    );

  if (rows.length === 0) return null;

  const product = rows[0];
  product.sub_images = rows
    .map(row => row.img_link)
    .filter(link => link && link !== product.thumbnail);

  return product;
}

export function addProduct(product) {
  return db('products').insert(product).returning('id');
}

export function addProductImages(images) {
  return db('product_images').insert(images);
}

export function updateProductThumbnail(productId, thumbnailPath) {
  return db('products')
    .where('id', productId)
    .update({ thumbnail: thumbnailPath });
}

export function updateProduct(productId, productData) {
  return db('products')
    .where('id', productId)
    .update(productData);
}

export function deleteProduct(productId) {
  return db('products')
    .where('id', productId)
    .del();
}

export function findForUpdate(productId, trx) {
  return (trx || db)('products').where('id', productId).forUpdate().first();
}

export function updateProductData(productId, productData, trx = null) {
  return (trx || db)('products').where('id', productId).update(productData);
}

export function markAsSold(productId, trx = null) {
  return (trx || db)('products').where('id', productId).update({ is_sold: true, closed_at: new Date() });
}

// Seller Statistics Functions
export function countProductsBySellerId(sellerId) {
  return db('products')
    .where('seller_id', sellerId)
    .count('id as count')
    .first();
}

export function countActiveProductsBySellerId(sellerId) {
  return db('products')
    .where('seller_id', sellerId)
    .where('end_at', '>', new Date())
    .whereNull('closed_at')
    .count('id as count')
    .first();
}

export function countSoldProductsBySellerId(sellerId) {
  return db('products')
    .where('seller_id', sellerId)
    .where('end_at', '<=', new Date())
    .where('is_sold', true)
    .count('id as count')
    .first();
}

export function countPendingProductsBySellerId(sellerId) {
  return db('products')
    .where('seller_id', sellerId)
    .where(function() {
      this.where('end_at', '<=', new Date())
        .orWhereNotNull('closed_at');
    })
    .whereNotNull('highest_bidder_id')
    .whereNull('is_sold')
    .count('id as count')
    .first();
}

export function countExpiredProductsBySellerId(sellerId) {
  return db('products')
    .where('seller_id', sellerId)
    .where(function() {
      this.where(function() {
        this.where('end_at', '<=', new Date())
            .whereNull('highest_bidder_id');
      })
      .orWhere('is_sold', false);
    })
    .count('id as count')
    .first();
}

export async function getSellerStats(sellerId) {
  const [total, active, sold, pending, expired, pendingRevenue, completedRevenue] = await Promise.all([
    countProductsBySellerId(sellerId),
    countActiveProductsBySellerId(sellerId),
    countSoldProductsBySellerId(sellerId),
    countPendingProductsBySellerId(sellerId),
    countExpiredProductsBySellerId(sellerId),
    db('products')
      .where('seller_id', sellerId)
      .where(function() {
        this.where('end_at', '<=', new Date())
          .orWhereNotNull('closed_at');
      })
      .whereNotNull('highest_bidder_id')
      .whereNull('is_sold')
      .sum('current_price as revenue')
      .first(),
    db('products')
      .where('seller_id', sellerId)
      .where('is_sold', true)
      .sum('current_price as revenue')
      .first()
  ]);

  const pendingRev = parseFloat(pendingRevenue.revenue) || 0;
  const completedRev = parseFloat(completedRevenue.revenue) || 0;

  return {
    total_products: parseInt(total.count) || 0,
    active_products: parseInt(active.count) || 0,
    sold_products: parseInt(sold.count) || 0,
    pending_products: parseInt(pending.count) || 0,
    expired_products: parseInt(expired.count) || 0,
    pending_revenue: pendingRev,
    completed_revenue: completedRev,
    total_revenue: pendingRev + completedRev
  };
}

export function findAllProductsBySellerId(sellerId) {
  return sellerProductBaseQuery(sellerId)
    .select(
      db.raw(`
        CASE
          WHEN is_sold IS TRUE THEN 'Sold'
          WHEN is_sold IS FALSE THEN 'Cancelled'
          WHEN (end_at <= NOW() OR closed_at IS NOT NULL) AND highest_bidder_id IS NOT NULL AND is_sold IS NULL THEN 'Pending'
          WHEN end_at <= NOW() AND highest_bidder_id IS NULL THEN 'No Bidders'
          WHEN end_at > NOW() AND closed_at IS NULL THEN 'Active'
        END AS status
      `)
    );
}

export function findActiveProductsBySellerId(sellerId) {
  return sellerProductBaseQuery(sellerId)
    .where('end_at', '>', new Date())
    .whereNull('closed_at');
}

export function findPendingProductsBySellerId(sellerId) {
  return sellerProductBaseQuery(sellerId)
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .where(function() {
      this.where('end_at', '<=', new Date())
        .orWhereNotNull('closed_at');
    })
    .whereNotNull('highest_bidder_id')
    .whereNull('is_sold')
    .select(
      'users.fullname as highest_bidder_name',
      'users.email as highest_bidder_email'
    );
}

export function findSoldProductsBySellerId(sellerId) {
  return sellerProductBaseQuery(sellerId)
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .where('end_at', '<=', new Date())
    .where('is_sold', true)
    .select(
      'users.fullname as highest_bidder_name',
      'users.email as highest_bidder_email'
    );
}

export function findExpiredProductsBySellerId(sellerId) {
  return db('products')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('seller_id', sellerId)
    .where(function() {
      this.where(function() {
        this.where('end_at', '<=', new Date())
            .whereNull('highest_bidder_id');
      })
      .orWhere('is_sold', false);
    })
    .select(
      'products.*',
      'categories.name as category_name',
      db.raw(`
        CASE
          WHEN highest_bidder_id IS NULL THEN 'No Bidders'
          ELSE 'Cancelled'
        END AS status
      `)
    );
}

export async function getSoldProductsStats(sellerId) {
  const result = await db('products')
    .where('seller_id', sellerId)
    .where('end_at', '<=', new Date())
    .where('is_sold', true)
    .select(
      db.raw('COUNT(products.id) as total_sold'),
      db.raw('COALESCE(SUM(products.current_price), 0) as total_revenue'),
      db.raw(`
        COALESCE(SUM((
          SELECT COUNT(*)
          FROM bidding_history
          WHERE bidding_history.product_id = products.id
        )), 0) as total_bids
      `)
    )
    .first();

  return {
    total_sold: parseInt(result.total_sold) || 0,
    total_revenue: parseFloat(result.total_revenue) || 0,
    total_bids: parseInt(result.total_bids) || 0
  };
}

export async function getPendingProductsStats(sellerId) {
  const result = await db('products')
    .where('seller_id', sellerId)
    .where(function() {
      this.where('end_at', '<=', new Date())
        .orWhereNotNull('closed_at');
    })
    .whereNotNull('highest_bidder_id')
    .whereNull('is_sold')
    .select(
      db.raw('COUNT(products.id) as total_pending'),
      db.raw('COALESCE(SUM(products.current_price), 0) as pending_revenue'),
      db.raw(`
        COALESCE(SUM((
          SELECT COUNT(*)
          FROM bidding_history
          WHERE bidding_history.product_id = products.id
        )), 0) as total_bids
      `)
    )
    .first();

  return {
    total_pending: parseInt(result.total_pending) || 0,
    pending_revenue: parseFloat(result.pending_revenue) || 0,
    total_bids: parseInt(result.total_bids) || 0
  };
}

export async function cancelProduct(productId, sellerId) {
  const product = await db('products')
    .where('id', productId)
    .first();
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  if (product.seller_id !== sellerId) {
    throw new Error('Unauthorized');
  }
  
  const activeOrders = await db('orders')
    .where('product_id', productId)
    .whereNotIn('status', ['completed', 'cancelled']);
  
  for (let order of activeOrders) {
    await db('orders')
      .where('id', order.id)
      .update({
        status: 'cancelled',
        cancelled_by: sellerId,
        cancellation_reason: 'Seller cancelled the product',
        cancelled_at: new Date()
      });
  }
  
  await updateProduct(productId, {
    is_sold: false,
    closed_at: new Date()
  });
  
  return product;
}

/**
 * Lấy các auction vừa kết thúc mà chưa gửi thông báo
 * Điều kiện: end_at < now() AND end_notification_sent IS NULL
 * @returns {Promise<Array>} Danh sách các sản phẩm kết thúc cần gửi thông báo
 */
export async function getNewlyEndedAuctions() {
  return db('products')
    .leftJoin('users as seller', 'products.seller_id', 'seller.id')
    .leftJoin('users as winner', 'products.highest_bidder_id', 'winner.id')
    .where('products.end_at', '<', new Date())
    .whereNull('products.end_notification_sent')
    .select(
      'products.id',
      'products.name',
      'products.current_price',
      'products.highest_bidder_id',
      'products.seller_id',
      'products.end_at',
      'products.is_sold',
      'seller.fullname as seller_name',
      'seller.email as seller_email',
      'winner.fullname as winner_name',
      'winner.email as winner_email'
    );
}

/**
 * Đánh dấu auction đã gửi thông báo kết thúc
 * @param {number} productId - ID sản phẩm
 */
export async function markEndNotificationSent(productId) {
  return db('products')
    .where('id', productId)
    .update({
      end_notification_sent: new Date()
    });
}

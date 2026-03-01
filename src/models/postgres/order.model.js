import db from '../../utils/db.js';
import { ORDER_STATUS } from '../../config/app.config.js';

/**
 * Maps each order status to the extra DB fields that must be stamped when
 * that status is entered.  To support a new status, add one entry here —
 * no switch/if chain needs to be touched (Open/Closed Principle).
 */
const STATUS_TIMESTAMPS = {
  [ORDER_STATUS.PAYMENT_SUBMITTED]:  ()           => ({ payment_submitted_at:  db.fn.now() }),
  [ORDER_STATUS.PAYMENT_CONFIRMED]:  ()           => ({ payment_confirmed_at:  db.fn.now() }),
  [ORDER_STATUS.SHIPPED]:            ()           => ({ shipped_at:            db.fn.now() }),
  [ORDER_STATUS.DELIVERED]:          ()           => ({ delivered_at:          db.fn.now() }),
  [ORDER_STATUS.COMPLETED]:          ()           => ({ completed_at:          db.fn.now() }),
  [ORDER_STATUS.CANCELLED]: (userId, note) => ({
    cancelled_at:     db.fn.now(),
    cancelled_by:     userId,
    ...(note ? { cancellation_reason: note } : {}),
  }),
};

/**
 * Create a new order. Usually triggered automatically when an auction ends.
 */
export async function createOrder(orderData) {
  const {
    product_id,
    seller_id,
    buyer_id,
    final_price,
    shipping_address,
    shipping_phone,
    shipping_note
  } = orderData;

  const rows = await db('orders').insert({
    product_id,
    seller_id,
    buyer_id,
    final_price,
    shipping_address,
    shipping_phone,
    shipping_note,
    status: ORDER_STATUS.PENDING_PAYMENT,
    created_at: db.fn.now()
  }).returning('*');

  return rows[0];
}

/**
 * Get order by ID.
 */
export async function findById(orderId) {
  return db('orders')
    .where('id', orderId)
    .first();
}

/**
 * Get order by product ID.
 */
export async function findByProductId(productId) {
  return db('orders')
    .where('product_id', productId)
    .first();
}

// internal helper that builds the common join/select block used by
// "withDetails" queries.  this keeps the WHERE clause (and any
// pagination/filtering) separate from the shared wiring of products,
// buyer, seller and category.  other functions can call this and then
// add their own where/limit/etc.
function orderWithDetailsQuery() {
  return db('orders')
    .leftJoin('products', 'orders.product_id', 'products.id')
    .leftJoin('users as buyer', 'orders.buyer_id', 'buyer.id')
    .leftJoin('users as seller', 'orders.seller_id', 'seller.id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .select(
      'orders.*',
      'products.name as product_name',
      'products.thumbnail as product_thumbnail',
      'products.end_at as product_end_at',
      'products.closed_at as product_closed_at',
      'categories.name as category_name',
      'buyer.id as buyer_id',
      'buyer.fullname as buyer_name',
      'buyer.email as buyer_email',
      'seller.id as seller_id',
      'seller.fullname as seller_name',
      'seller.email as seller_email'
    );
}

export async function findByIdWithDetails(orderId) {
  return orderWithDetailsQuery()
    .where('orders.id', orderId)
    .first();
}

/**
 * Get order by product ID with full details.
 */
export async function findByProductIdWithDetails(productId) {
  return orderWithDetailsQuery()
    .where('orders.product_id', productId)
    .first();
}

/**
 * Get all orders for a seller.
 */
// small helper for queries that only need product info plus a single
// user (either buyer or seller).  the caller just specifies the alias
// and the label that will be used in the select clause.
function ordersWithProductAndUserQuery(userAlias, selectName) {
  return db('orders')
    .leftJoin('products', 'orders.product_id', 'products.id')
    .leftJoin(`users as ${userAlias}`, `orders.${userAlias}_id`, `${userAlias}.id`)
    .select(
      'orders.*',
      'products.name as product_name',
      'products.thumbnail as product_thumbnail',
      `${userAlias}.fullname as ${selectName}`
    );
}

export async function findBySellerId(sellerId) {
  return ordersWithProductAndUserQuery('buyer', 'buyer_name')
    .where('orders.seller_id', sellerId)
    .orderBy('orders.created_at', 'desc');
}

/**
 * Get all orders for a buyer.
 */
export async function findByBuyerId(buyerId) {
  return ordersWithProductAndUserQuery('seller', 'seller_name')
    .where('orders.buyer_id', buyerId)
    .orderBy('orders.created_at', 'desc');
}

/**
 * Update order status and stamp the corresponding timestamp.
 */
export async function updateStatus(orderId, newStatus, userId, note = null) {
  const trx = await db.transaction();
  
  try {
    // Fetch current status
    const order = await trx('orders')
      .where('id', orderId)
      .first();
    
    if (!order) {
      throw new Error('Order not found');
    }

    const oldStatus = order.status;
    
    // Apply status update
    const updateData = {
      status: newStatus,
      updated_at: db.fn.now()
    };

    // Stamp the timestamp field(s) that correspond to the new status.
    // Lookup is O(1) and adding a new status never requires editing this function.
    const extraFields = STATUS_TIMESTAMPS[newStatus]?.(userId, note) ?? {};
    Object.assign(updateData, extraFields);

    await trx('orders')
      .where('id', orderId)
      .update(updateData);

    // Log status transition
    await trx('order_status_history').insert({
      order_id: orderId,
      from_status: oldStatus,
      to_status: newStatus,
      changed_by: userId,
      note: note,
      created_at: db.fn.now()
    });

    await trx.commit();
    
    return findById(orderId);
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}

/**
 * Update shipping information for an order.
 */
export async function updateShippingInfo(orderId, shippingData) {
  const {
    shipping_address,
    shipping_phone,
    shipping_note
  } = shippingData;

  const rows = await db('orders')
    .where('id', orderId)
    .update({
      shipping_address,
      shipping_phone,
      shipping_note,
      updated_at: db.fn.now()
    })
    .returning('*');

  return rows[0];
}

/**
 * Update tracking information for an order.
 */
export async function updateTracking(orderId, trackingData) {
  const {
    tracking_number,
    shipping_provider
  } = trackingData;

  const rows = await db('orders')
    .where('id', orderId)
    .update({
      tracking_number,
      shipping_provider,
      updated_at: db.fn.now()
    })
    .returning('*');

  return rows[0];
}

/**
 * Cancel an order.
 */
export async function cancelOrder(orderId, userId, reason) {
  return updateStatus(orderId, ORDER_STATUS.CANCELLED, userId, reason);
}

/**
 * Check whether a user is authorized to access an order (as buyer or seller).
 */
export async function canUserAccessOrder(orderId, userId) {
  const order = await db('orders')
    .where('id', orderId)
    .where(function() {
      this.where('seller_id', userId)
        .orWhere('buyer_id', userId);
    })
    .first();

  return !!order;
}

/**
 * Get status change history for an order.
 */
export async function getStatusHistory(orderId) {
  return db('order_status_history')
    .leftJoin('users', 'order_status_history.changed_by', 'users.id')
    .where('order_id', orderId)
    .select(
      'order_status_history.*',
      'users.fullname as changed_by_name'
    )
    .orderBy('order_status_history.created_at', 'desc');
}

/**
 * Count orders by status for a user.
 */
export async function countByStatus(userId, userType = 'buyer') {
  const column = userType === 'buyer' ? 'buyer_id' : 'seller_id';
  
  return db('orders')
    .where(column, userId)
    .select('status')
    .count('* as count')
    .groupBy('status');
}

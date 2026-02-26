import db from '../utils/db.js';

/**
 * ============================================
 * ORDER MODEL
 * ============================================
 * Quản lý đơn hàng sau khi đấu giá kết thúc
 * 
 * Quy trình:
 * 1. pending_payment: Chờ buyer gửi chứng từ thanh toán
 * 2. payment_submitted: Buyer đã gửi chứng từ
 * 3. payment_confirmed: Seller xác nhận đã nhận tiền
 * 4. shipped: Seller đã gửi hàng
 * 5. delivered: Buyer xác nhận đã nhận hàng
 * 6. completed: Hoàn tất (đã đánh giá)
 * 7. cancelled: Đơn hàng bị hủy
 */

/**
 * Tạo order mới (thường được trigger tự động tạo)
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
    status: 'pending_payment',
    created_at: db.fn.now()
  }).returning('*');

  return rows[0];
}

/**
 * Lấy thông tin order theo ID
 */
export async function findById(orderId) {
  return db('orders')
    .where('id', orderId)
    .first();
}

/**
 * Lấy order theo product_id
 */
export async function findByProductId(productId) {
  return db('orders')
    .where('product_id', productId)
    .first();
}

/**
 * Lấy order kèm thông tin đầy đủ (product, buyer, seller)
 */
export async function findByIdWithDetails(orderId) {
  return db('orders')
    .leftJoin('products', 'orders.product_id', 'products.id')
    .leftJoin('users as buyer', 'orders.buyer_id', 'buyer.id')
    .leftJoin('users as seller', 'orders.seller_id', 'seller.id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('orders.id', orderId)
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
    )
    .first();
}

/**
 * Lấy order theo product_id kèm thông tin đầy đủ
 */
export async function findByProductIdWithDetails(productId) {
  return db('orders')
    .leftJoin('products', 'orders.product_id', 'products.id')
    .leftJoin('users as buyer', 'orders.buyer_id', 'buyer.id')
    .leftJoin('users as seller', 'orders.seller_id', 'seller.id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('orders.product_id', productId)
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
    )
    .first();
}

/**
 * Lấy tất cả orders của một seller
 */
export async function findBySellerId(sellerId) {
  return db('orders')
    .leftJoin('products', 'orders.product_id', 'products.id')
    .leftJoin('users as buyer', 'orders.buyer_id', 'buyer.id')
    .where('orders.seller_id', sellerId)
    .select(
      'orders.*',
      'products.name as product_name',
      'products.thumbnail as product_thumbnail',
      'buyer.fullname as buyer_name'
    )
    .orderBy('orders.created_at', 'desc');
}

/**
 * Lấy tất cả orders của một buyer
 */
export async function findByBuyerId(buyerId) {
  return db('orders')
    .leftJoin('products', 'orders.product_id', 'products.id')
    .leftJoin('users as seller', 'orders.seller_id', 'seller.id')
    .where('orders.buyer_id', buyerId)
    .select(
      'orders.*',
      'products.name as product_name',
      'products.thumbnail as product_thumbnail',
      'seller.fullname as seller_name'
    )
    .orderBy('orders.created_at', 'desc');
}

/**
 * Cập nhật trạng thái order
 */
export async function updateStatus(orderId, newStatus, userId, note = null) {
  const trx = await db.transaction();
  
  try {
    // Lấy trạng thái cũ
    const order = await trx('orders')
      .where('id', orderId)
      .first();
    
    if (!order) {
      throw new Error('Order not found');
    }

    const oldStatus = order.status;
    
    // Cập nhật order
    const updateData = {
      status: newStatus,
      updated_at: db.fn.now()
    };

    // Cập nhật timestamp tương ứng
    switch (newStatus) {
      case 'payment_submitted':
        updateData.payment_submitted_at = db.fn.now();
        break;
      case 'payment_confirmed':
        updateData.payment_confirmed_at = db.fn.now();
        break;
      case 'shipped':
        updateData.shipped_at = db.fn.now();
        break;
      case 'delivered':
        updateData.delivered_at = db.fn.now();
        break;
      case 'completed':
        updateData.completed_at = db.fn.now();
        break;
      case 'cancelled':
        updateData.cancelled_at = db.fn.now();
        updateData.cancelled_by = userId;
        if (note) {
          updateData.cancellation_reason = note;
        }
        break;
    }

    await trx('orders')
      .where('id', orderId)
      .update(updateData);

    // Ghi log vào order_status_history
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
 * Cập nhật thông tin giao hàng
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
 * Cập nhật thông tin tracking
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
 * Hủy order
 */
export async function cancelOrder(orderId, userId, reason) {
  return updateStatus(orderId, 'cancelled', userId, reason);
}

/**
 * Kiểm tra user có quyền truy cập order không
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
 * Lấy lịch sử trạng thái của order
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
 * Đếm số order theo trạng thái của một user
 */
export async function countByStatus(userId, userType = 'buyer') {
  const column = userType === 'buyer' ? 'buyer_id' : 'seller_id';
  
  return db('orders')
    .where(column, userId)
    .select('status')
    .count('* as count')
    .groupBy('status');
}

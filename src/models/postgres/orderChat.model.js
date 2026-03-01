import db from '../../utils/db.js';

/**
 * Send a message in an order chat.
 */
export async function sendMessage(messageData) {
  const {
    order_id,
    sender_id,
    message
  } = messageData;

  const rows = await db('order_chats').insert({
    order_id,
    sender_id,
    message,
    created_at: db.fn.now()
  }).returning('*');

  return rows[0];
}

/**
 * Get all messages for an order.
 */
export async function getMessagesByOrderId(orderId) {
  return db('order_chats')
    .leftJoin('users as sender', 'order_chats.sender_id', 'sender.id')
    .where('order_chats.order_id', orderId)
    .select(
      'order_chats.*',
      'sender.fullname as sender_name',
      'sender.role as sender_role'
    )
    .orderBy('order_chats.created_at', 'asc');
}

/**
 * Delete a message.
 */
export async function deleteMessage(messageId) {
  return db('order_chats')
    .where('id', messageId)
    .del();
}

/**
 * Get the most recent message for an order.
 */
export async function getLatestMessage(orderId) {
  return db('order_chats')
    .leftJoin('users as sender', 'order_chats.sender_id', 'sender.id')
    .where('order_chats.order_id', orderId)
    .select(
      'order_chats.*',
      'sender.fullname as sender_name'
    )
    .orderBy('order_chats.created_at', 'desc')
    .first();
}

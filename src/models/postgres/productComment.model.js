import db from '../../utils/db.js';

// ── Internal Query Helper ────────────────────────────────────
/** Base query joining users to product_comments — reused by get/replies functions. */
function commentWithUserQuery() {
  return db('product_comments')
    .join('users', 'product_comments.user_id', 'users.id')
    .select(
      'product_comments.*',
      'users.fullname as user_name',
      'users.role as user_role'
    );
}

/**
 * Create a new comment on a product.
 */
export async function createComment(productId, userId, content, parentId = null) {
  return db('product_comments').insert({
    product_id: productId,
    user_id: userId,
    content: content,
    parent_id: parentId,
    created_at: new Date()
  }).returning('*');
}

/**
 * Get all parent comments for a product with pagination.
 */
export async function getCommentsByProductId(productId, limit = null, offset = 0) {
  let query = commentWithUserQuery()
    .where('product_comments.product_id', productId)
    .whereNull('product_comments.parent_id')
    .orderBy('product_comments.created_at', 'desc');

  if (limit !== null) {
    query = query.limit(limit).offset(offset);
  }

  return query;
}

/**
 * Count total parent comments for a product.
 */
export async function countCommentsByProductId(productId) {
  const result = await db('product_comments')
    .where('product_id', productId)
    .whereNull('parent_id')
    .count('* as count')
    .first();
  return parseInt(result.count);
}

/**
 * Get replies for a comment.
 */
export async function getRepliesByCommentId(commentId) {
  return commentWithUserQuery()
    .where('product_comments.parent_id', commentId)
    .orderBy('product_comments.created_at', 'asc');
}

/**
 * Get replies for multiple comments in a single query (avoids N+1).
 * @param {Array<number>} commentIds - Array of comment IDs
 * @returns {Promise<Array>} List of replies
 */
export async function getRepliesByCommentIds(commentIds) {
  if (!commentIds || commentIds.length === 0) {
    return [];
  }
  
  return commentWithUserQuery()
    .whereIn('product_comments.parent_id', commentIds)
    .orderBy('product_comments.created_at', 'asc');
}

/**
 * Delete a comment.
 */
export async function deleteComment(commentId, userId) {
  return db('product_comments')
    .where('id', commentId)
    .where('user_id', userId)
    .delete();
}

/**
 * Get a comment by ID.
 */
export async function findCommentById(commentId) {
  return db('product_comments')
    .where('id', commentId)
    .first();
}

/**
 * Get unique commenters for a product with their emails.
 * @param {number} productId - Product ID
 * @returns {Promise<Array>} List of commenters with email
 */
export async function getUniqueCommenters(productId) {
  return db('product_comments')
    .join('users', 'product_comments.user_id', 'users.id')
    .where('product_comments.product_id', productId)
    .distinct('users.id', 'users.email', 'users.fullname')
    .select('users.id', 'users.email', 'users.fullname');
}

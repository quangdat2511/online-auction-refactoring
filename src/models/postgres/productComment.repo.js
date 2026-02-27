import db from '../../utils/db.js';

// ── Internal Query Helper ────────────────────────────────────
function commentWithUserQuery() {
  return db('product_comments')
    .join('users', 'product_comments.user_id', 'users.id')
    .select(
      'product_comments.*',
      'users.fullname as user_name',
      'users.role as user_role'
    );
}

export async function createComment(productId, userId, content, parentId = null) {
  return db('product_comments').insert({
    product_id: productId, user_id: userId, content, parent_id: parentId, created_at: new Date()
  }).returning('*');
}

export async function getCommentsByProductId(productId, limit = null, offset = 0) {
  let query = commentWithUserQuery()
    .where('product_comments.product_id', productId)
    .whereNull('product_comments.parent_id')
    .orderBy('product_comments.created_at', 'desc');
  if (limit !== null) query = query.limit(limit).offset(offset);
  return query;
}

export async function countCommentsByProductId(productId) {
  const result = await db('product_comments')
    .where('product_id', productId)
    .whereNull('parent_id')
    .count('* as count')
    .first();
  return parseInt(result.count);
}

export async function getRepliesByCommentId(commentId) {
  return commentWithUserQuery()
    .where('product_comments.parent_id', commentId)
    .orderBy('product_comments.created_at', 'asc');
}

export async function getRepliesByCommentIds(commentIds) {
  if (!commentIds || commentIds.length === 0) return [];
  return commentWithUserQuery()
    .whereIn('product_comments.parent_id', commentIds)
    .orderBy('product_comments.created_at', 'asc');
}

export async function deleteComment(commentId, userId) {
  return db('product_comments').where('id', commentId).where('user_id', userId).delete();
}

export async function findCommentById(commentId) {
  return db('product_comments').where('id', commentId).first();
}

export async function getUniqueCommenters(productId) {
  return db('product_comments')
    .join('users', 'product_comments.user_id', 'users.id')
    .where('product_comments.product_id', productId)
    .distinct('users.id', 'users.email', 'users.fullname')
    .select('users.id', 'users.email', 'users.fullname');
}

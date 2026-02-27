import db from '../utils/db.js';

export function addUpdate(productId, content) {
  return db('product_description_updates').insert({
    product_id: productId,
    content: content
    // created_at will use database default CURRENT_TIMESTAMP
  });
}

export function findByProductId(productId) {
  return db('product_description_updates')
    .where('product_id', productId)
    .orderBy('created_at', 'asc');
}

export function findById(updateId) {
  return db('product_description_updates')
    .where('id', updateId)
    .first();
}

export function updateContent(updateId, content) {
  return db('product_description_updates')
    .where('id', updateId)
    .update({ content });
}

export function deleteUpdate(updateId) {
  return db('product_description_updates')
    .where('id', updateId)
    .del();
}

export function deleteByProductId(productId) {
  return db('product_description_updates')
    .where('product_id', productId)
    .del();
}

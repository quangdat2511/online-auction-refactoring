import db from '../../utils/db.js';

export function calculateRatingPoint(user_id) {
  return db('reviews')
    .where('reviewee_id', user_id)
    .select(db.raw(`
      CASE 
        WHEN (COUNT(CASE WHEN rating = -1 THEN 1 END) + COUNT(CASE WHEN rating = 1 THEN 1 END)) = 0 
        THEN 0
        ELSE 
          COUNT(CASE WHEN rating = 1 THEN 1 END)::float / 
          (COUNT(CASE WHEN rating = -1 THEN 1 END) + COUNT(CASE WHEN rating = 1 THEN 1 END))
      END as rating_point
    `))
    .first();
}

export function getReviewsByUserId(user_id) {
  return db('reviews')
    .join('users as reviewer', 'reviews.reviewer_id', 'reviewer.id')
    .join('products', 'reviews.product_id', 'products.id')
    .where('reviews.reviewee_id', user_id)
    .whereNot('reviews.rating', 0)
    .select('reviews.*', 'reviewer.fullname as reviewer_name', 'products.name as product_name')
    .orderBy('reviews.created_at', 'desc');
}

export function createReview(reviewData) {
  return db('reviews').insert(reviewData).returning('*');
}

export function getProductReview(reviewer_id, reviewee_id, product_id) {
  return db('reviews')
    .where('reviewer_id', reviewer_id)
    .where('reviewee_id', reviewee_id)
    .where('product_id', product_id)
    .first();
}

export function updateReview(reviewer_id, reviewee_id, product_id, updateData) {
  return db('reviews')
    .where('reviewer_id', reviewer_id)
    .where('reviewee_id', reviewee_id)
    .where('product_id', product_id)
    .update(updateData);
}

export function findByReviewerAndProduct(reviewer_id, product_id) {
  return db('reviews').where('reviewer_id', reviewer_id).where('product_id', product_id).first();
}

export function create(data) {
  return db('reviews').insert({
    reviewer_id: data.reviewer_id,
    reviewee_id: data.reviewed_user_id,
    product_id: data.product_id,
    rating: data.rating,
    comment: data.comment,
    created_at: new Date()
  });
}

export function updateByReviewerAndProduct(reviewer_id, product_id, updateData) {
  return db('reviews').where('reviewer_id', reviewer_id).where('product_id', product_id).update(updateData);
}

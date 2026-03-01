import db from '../../utils/db.js';

export function calculateRatingPoint(user_id) {
  return db('reviews')
    .where('reviewee_id', user_id)
    .select(
      db.raw(`
                CASE 
                    WHEN (COUNT(CASE WHEN rating = -1 THEN 1 END) + COUNT(CASE WHEN rating = 1 THEN 1 END)) = 0 
                    THEN 0
                    ELSE 
                        COUNT(CASE WHEN rating = 1 THEN 1 END)::float / 
                        (COUNT(CASE WHEN rating = -1 THEN 1 END) + COUNT(CASE WHEN rating = 1 THEN 1 END))
                END as rating_point
            `)
    )
    .first();
}

/**
 * Get all reviews for a user (as reviewee).
 * @param {number} user_id - User ID
 * @returns {Promise<Array>} List of reviews
 */
export function getReviewsByUserId(user_id) {
  return db('reviews')
    .join('users as reviewer', 'reviews.reviewer_id', 'reviewer.id')
    .join('products', 'reviews.product_id', 'products.id')
    .where('reviews.reviewee_id', user_id)
    .whereNot('reviews.rating', 0) // Exclude skipped reviews (rating=0)
    .select(
      'reviews.*',
      'reviewer.fullname as reviewer_name',
      'products.name as product_name'
    )
    .orderBy('reviews.created_at', 'desc');
}

/**
 * Create a new review.
 * @param {Object} reviewData - Review data object
 * @returns {Promise} Insert result
 */
export function createReview(reviewData) {
  return db('reviews').insert(reviewData).returning('*');
}

/**
 * Get a reviewer's review for a specific reviewee on a specific product.
 * @param {number} reviewer_id - Reviewer ID
 * @param {number} reviewee_id - Reviewee ID
 * @param {number} product_id - Product ID
 * @returns {Promise<Object>} Review object or null
 */
export function getProductReview(reviewer_id, reviewee_id, product_id) {
  return db('reviews')
    .where('reviewer_id', reviewer_id)
    .where('reviewee_id', reviewee_id)
    .where('product_id', product_id)
    .first();
}

/**
 * Update a review.
 * @param {number} reviewer_id - Reviewer ID
 * @param {number} reviewee_id - Reviewee ID
 * @param {number} product_id - Product ID
 * @param {Object} updateData - Fields to update: {rating, comment}
 * @returns {Promise} Update result
 */
export function updateReview(reviewer_id, reviewee_id, product_id, updateData) {
  return db('reviews')
    .where('reviewer_id', reviewer_id)
    .where('reviewee_id', reviewee_id)
    .where('product_id', product_id)
    .update(updateData);
}

/**
 * Find a review by reviewer and product (reviewee not required).
 * @param {number} reviewer_id - Reviewer ID
 * @param {number} product_id - Product ID
 * @returns {Promise<Object>} Review object or null
 */
export function findByReviewerAndProduct(reviewer_id, product_id) {
  return db('reviews')
    .where('reviewer_id', reviewer_id)
    .where('product_id', product_id)
    .first();
}

/**
 * Create a new review (for a bidder reviewing a seller).
 * @param {Object} data - {reviewer_id, reviewed_user_id, product_id, rating, comment}
 * @returns {Promise} Insert result
 */
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

/**
 * Update a review by reviewer and product.
 * @param {number} reviewer_id - Reviewer ID
 * @param {number} product_id - Product ID
 * @param {Object} updateData - Fields to update: {rating, comment}
 * @returns {Promise} Update result
 */
export function updateByReviewerAndProduct(reviewer_id, product_id, updateData) {
  return db('reviews')
    .where('reviewer_id', reviewer_id)
    .where('product_id', product_id)
    .update(updateData);
}
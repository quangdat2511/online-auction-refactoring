import db from '../utils/db.js';

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
 * Lấy tất cả reviews của user (được đánh giá)
 * @param {number} user_id - ID của user
 * @returns {Promise<Array>} Danh sách reviews
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
 * Tạo review mới
 * @param {Object} reviewData - Dữ liệu review
 * @returns {Promise} Kết quả insert
 */
export function createReview(reviewData) {
    return db('reviews').insert(reviewData).returning('*');
}
/**
 * Lấy review của reviewer cho reviewee trên product cụ thể
 * @param {number} reviewer_id - ID người đánh giá
 * @param {number} reviewee_id - ID người được đánh giá
 * @param {number} product_id - ID sản phẩm
 * @returns {Promise<Object>} Review object hoặc null
 */
export function getProductReview(reviewer_id, reviewee_id, product_id) {
    return db('reviews')
        .where('reviewer_id', reviewer_id)
        .where('reviewee_id', reviewee_id)
        .where('product_id', product_id)
        .first();
}

/**
 * Cập nhật review
 * @param {number} reviewer_id - ID người đánh giá
 * @param {number} reviewee_id - ID người được đánh giá
 * @param {number} product_id - ID sản phẩm
 * @param {Object} updateData - Dữ liệu cần cập nhật {rating, comment}
 * @returns {Promise} Kết quả update
 */
export function updateReview(reviewer_id, reviewee_id, product_id, updateData) {
    return db('reviews')
        .where('reviewer_id', reviewer_id)
        .where('reviewee_id', reviewee_id)
        .where('product_id', product_id)
        .update(updateData);
}

/**
 * Tìm review theo reviewer và product (không cần biết reviewee)
 * @param {number} reviewer_id - ID người đánh giá
 * @param {number} product_id - ID sản phẩm
 * @returns {Promise<Object>} Review object hoặc null
 */
export function findByReviewerAndProduct(reviewer_id, product_id) {
    return db('reviews')
        .where('reviewer_id', reviewer_id)
        .where('product_id', product_id)
        .first();
}

/**
 * Tạo review mới (cho bidder đánh giá seller)
 * @param {Object} data - {reviewer_id, reviewed_user_id, product_id, rating, comment}
 * @returns {Promise} Kết quả insert
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
 * Cập nhật review theo reviewer và product
 * @param {number} reviewer_id - ID người đánh giá
 * @param {number} product_id - ID sản phẩm
 * @param {Object} updateData - Dữ liệu cần cập nhật {rating, comment}
 * @returns {Promise} Kết quả update
 */
export function updateByReviewerAndProduct(reviewer_id, product_id, updateData) {
    return db('reviews')
        .where('reviewer_id', reviewer_id)
        .where('product_id', product_id)
        .update(updateData);
}
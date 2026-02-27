import db from '../utils/db.js';

export function searchPageByUserId(user_id, limit, offset) {
    return db('watchlists')
        .join('products', 'watchlists.product_id', 'products.id')
        .where('watchlists.user_id', user_id)
        .limit(limit)
        .offset(offset)
        .select('products.*');
}

export function countByUserId(user_id) {
    return db('watchlists')
        .where('user_id', user_id)
        .count('product_id as count')
        .first();
}
export function isInWatchlist(user_id, product_id) {
    return db('watchlists')
        .where({ user_id: user_id, product_id: product_id })
        .first()
        .then(row => !!row);
}
export function addToWatchlist(user_id, product_id) {
    return db('watchlists')
        .insert({ user_id: user_id, product_id: product_id });
}
export function removeFromWatchlist(user_id, product_id) {
    return db('watchlists')
        .where({ user_id: user_id, product_id: product_id })
        .del();
}
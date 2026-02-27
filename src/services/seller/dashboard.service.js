import * as productModel from '../../models/product.model.js';

// Dashboard-related helper for seller area
export function getSellerStats(sellerId) {
  return productModel.getSellerStats(sellerId);
}

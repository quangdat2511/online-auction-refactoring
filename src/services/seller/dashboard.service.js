import { productModel } from '../../models/index.js';

// Dashboard-related helper for seller area
export function getSellerStats(sellerId) {
  return productModel.getSellerStats(sellerId);
}

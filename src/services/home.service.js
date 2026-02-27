import * as productModel from '../models/product.model.js';

export async function getHomeProducts() {
  const [topEnding, topBids, topPrice] = await Promise.all([
    productModel.findTopEnding(),
    productModel.findTopBids(),
    productModel.findTopPrice()
  ]);
  return { topEnding, topBids, topPrice };
}

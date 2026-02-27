import { productModel, userModel } from '../../models/index.js';
import { moveProductImages } from '../../utils/productImageHelper.js';

export async function listProducts() {
  const products = await productModel.findAll();
  return products.map(p => ({
    id: p.id,
    name: p.name,
    seller_name: p.seller_name,
    current_price: p.current_price,
    highest_bidder_name: p.highest_bidder_name,
  }));
}

export async function getProductById(id) {
  return productModel.findByProductIdForAdmin(id);
}

export async function getSellers() {
  return userModel.findUsersByRole('seller');
}

export async function addProduct(productRaw, thumbnail, imgsList) {
  const productData = {
    seller_id: productRaw.seller_id,
    category_id: productRaw.category_id,
    name: productRaw.name,
    starting_price: productRaw.start_price.replace(/,/g, ''),
    step_price: productRaw.step_price.replace(/,/g, ''),
    buy_now_price: productRaw.buy_now_price !== '' ? productRaw.buy_now_price.replace(/,/g, '') : null,
    created_at: productRaw.created_at,
    end_at: productRaw.end_date,
    auto_extend: productRaw.auto_extend === '1',
    thumbnail: null,
    description: productRaw.description,
    highest_bidder_id: null,
    current_price: productRaw.start_price.replace(/,/g, ''),
    is_sold: null,
    closed_at: null,
    allow_unrated_bidder: productRaw.allow_new_bidders === '1',
  };

  const returnedID = await productModel.addProduct(productData);
  const productId = returnedID[0].id;

  // move images and update paths
  const { thumbnailPath, imagePaths } = await moveProductImages(productId, thumbnail, imgsList);
  if (thumbnailPath) {
    await productModel.updateProductThumbnail(productId, thumbnailPath);
  }
  if (imagePaths.length) {
    await productModel.addProductImages(imagePaths);
  }
}

export async function updateProduct(id, data) {
  await productModel.updateProduct(id, data);
}

export async function deleteProduct(id) {
  await productModel.deleteProduct(id);
}

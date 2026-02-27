import path from 'path';
import fs from 'fs';
import * as productModel from '../../models/product.model.js';
import * as userModel from '../../models/user.model.js';

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
  const dirPath = path.join('public', 'images', 'products').replace(/\\/g, '/');

  // Move and rename thumbnail
  const mainPath = path.join(dirPath, `p${productId}_thumb.jpg`).replace(/\\/g, '/');
  const oldMainPath = path.join('public', 'uploads', path.basename(thumbnail)).replace(/\\/g, '/');
  const savedMainPath = '/' + path.join('images', 'products', `p${productId}_thumb.jpg`).replace(/\\/g, '/');
  fs.renameSync(oldMainPath, mainPath);
  await productModel.updateProductThumbnail(productId, savedMainPath);

  // Move and rename sub-images
  let i = 1;
  const newImgPaths = [];
  for (const imgPath of imgsList) {
    const oldPath = path.join('public', 'uploads', path.basename(imgPath)).replace(/\\/g, '/');
    const newPath = path.join(dirPath, `p${productId}_${i}.jpg`).replace(/\\/g, '/');
    const savedPath = '/' + path.join('images', 'products', `p${productId}_${i}.jpg`).replace(/\\/g, '/');
    fs.renameSync(oldPath, newPath);
    newImgPaths.push({ product_id: productId, img_link: savedPath });
    i++;
  }
  await productModel.addProductImages(newImgPaths);
}

export async function updateProduct(id, data) {
  await productModel.updateProduct(id, data);
}

export async function deleteProduct(id) {
  await productModel.deleteProduct(id);
}

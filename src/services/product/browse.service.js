import * as productModel from '../../models/product.model.js';
import * as categoryModel from '../../models/category.model.js';
import * as systemSettingModel from '../../models/systemSetting.model.js';
import { PAGINATION } from '../../config/app.config.js';

async function prepareProductList(products) {
  const now = new Date();
  if (!products) return [];

  const settings = await systemSettingModel.getSettings();
  const N_MINUTES = settings.new_product_limit_minutes;

  return products.map(product => {
    const created = new Date(product.created_at);
    const isNew = (now - created) < (N_MINUTES * 60 * 1000);
    return { ...product, is_new: isNew };
  });
}

export async function getProductsByCategory({ categoryId, page = 1, sort = '', userId = null, limit = PAGINATION.PRODUCTS_PER_PAGE }) {
  const offset = (page - 1) * limit;

  const category = await categoryModel.findByCategoryId(categoryId);

  let categoryIds = [categoryId];
  if (category && category.parent_id === null) {
    const childCategories = await categoryModel.findChildCategoryIds(categoryId);
    categoryIds = [categoryId, ...childCategories.map(cat => cat.id)];
  }

  const list = await productModel.findByCategoryIds(categoryIds, limit, offset, sort, userId);
  const products = await prepareProductList(list);
  const total = await productModel.countByCategoryIds(categoryIds);
  const totalCount = parseInt(total.count) || 0;
  const nPages = Math.ceil(totalCount / limit);

  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) { from = 0; to = 0; }

  return {
    products,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages: nPages,
    categoryId,
    categoryName: category ? category.name : null,
    sort,
  };
}

export async function searchProducts({ keywords, page = 1, sort = '', logic = 'and', userId = null, limit = PAGINATION.PRODUCTS_PER_PAGE }) {
  if (!keywords || keywords.trim().length === 0) {
    return {
      products: [],
      totalCount: 0,
      from: 0,
      to: 0,
      currentPage: 1,
      totalPages: 0,
      q: keywords,
      logic,
      sort,
    };
  }

  const offset = (page - 1) * limit;
  const q = keywords.trim();

  const list = await productModel.searchPageByKeywords(q, limit, offset, userId, logic, sort);
  const products = await prepareProductList(list);
  const total = await productModel.countByKeywords(q, logic);
  const totalCount = parseInt(total.count) || 0;
  const nPages = Math.ceil(totalCount / limit);

  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) { from = 0; to = 0; }

  return {
    products,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages: nPages,
    q: keywords,
    logic,
    sort,
  };
}

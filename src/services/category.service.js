import { categoryModel } from '../models/index.js';

export async function getCategoriesWithLevel() {
  const categories = await categoryModel.findAll();
  return categories.map(cat => ({
    ...cat,
    level: cat.parent_id ? 2 : 1,
  }));
}

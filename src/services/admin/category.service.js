import { categoryModel } from '../../models/index.js';

export async function listCategories() {
  return categoryModel.findAll();
}

export async function getCategoryById(id) {
  return categoryModel.findByCategoryId(id);
}

export async function getParentCategories() {
  return categoryModel.findLevel1Categories();
}

export async function createCategory({ name, parent_id }) {
  await categoryModel.createCategory({ name, parent_id: parent_id || null });
}

export async function updateCategory(id, { name, parent_id }) {
  await categoryModel.updateCategory(id, { name, parent_id: parent_id || null });
}

export async function deleteCategory(id) {
  const hasProducts = await categoryModel.isCategoryHasProducts(id);
  if (hasProducts) return { success: false, reason: 'has_products' };
  await categoryModel.deleteCategory(id);
  return { success: true };
}

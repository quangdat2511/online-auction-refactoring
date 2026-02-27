import { categoryModel } from '../models/index.js';

export async function categoryMiddleware(req, res, next) {
  const plist = await categoryModel.findLevel1Categories();
  const clist = await categoryModel.findLevel2Categories();
  res.locals.lcCategories1 = plist;
  res.locals.lcCategories2 = clist;
  next();
}

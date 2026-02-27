import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { configureExpress } from './config/express.config.js';
import { configurePassport } from './config/passport.config.js';
import { configureHandlebars } from './config/handlebars.config.js';
import { userSessionMiddleware } from './middlewares/userSession.mdw.js';
import { categoryMiddleware } from './middlewares/category.mdw.js';

// Import Scheduled Jobs
import { startAuctionEndNotifier } from './scripts/auctionEndNotifier.js';

// Import Routes
import homeRouter from './routes/home.route.js';
import productRouter from './routes/product/index.js';
import accountRouter from './routes/account/index.js';
import adminRouter from './routes/admin/index.js';
import sellerRouter from './routes/seller/index.js';

// Import Middlewares
import { isAuthenticated, isSeller, isAdmin, setAdminMode } from './middlewares/auth.mdw.js';
import * as categoryModel from './models/category.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// 1. CẤU HÌNH CỐT LÕI
configureExpress(app);
configurePassport(app);

// 2. CẤU HÌNH VIEW ENGINE (Handlebars)
configureHandlebars(app);

// XEM LẠI SAU
//********************************************************************/
// Tạo thư mục uploads nếu chưa có
const uploadDir = path.join(__dirname, 'public', 'images', 'products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// File filter (chỉ cho phép ảnh)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed!'));
  }
};
/************************************************************************/

// 3. MIDDLEWARE TOÀN CỤC
app.use(userSessionMiddleware);
app.use(categoryMiddleware);

// 4. CẤU HÌNH LOGIC ADMIN
app.use('/admin', isAdmin, setAdminMode);

// 5. ROUTES
// Các Route Admin
app.use('/admin', adminRouter);

// Các Route Seller
app.use('/seller', isAuthenticated, isSeller, sellerRouter);


// Xem lại sau
//********************************************************************/
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await categoryModel.findAll();
    const categoriesWithLevel = categories.map(cat => ({
      ...cat,
      level: cat.parent_id ? 2 : 1
    }));
    res.json({ categories: categoriesWithLevel });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});
//************************************************************************/

app.use('/', homeRouter);
app.use('/products', productRouter);
app.use('/account', accountRouter);

app.listen(PORT, function () {
  console.log(`Server is running on http://localhost:${PORT}`);
  startAuctionEndNotifier(30);
});
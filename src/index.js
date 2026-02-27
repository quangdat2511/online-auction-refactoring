import 'dotenv/config';
import express from 'express';
import { configureExpress } from './config/express.config.js';
import { configurePassport } from './config/passport.config.js';
import { configureHandlebars } from './config/handlebars.config.js';
import { userSessionMiddleware } from './middlewares/userSession.mdw.js';
import { categoryMiddleware } from './middlewares/category.mdw.js';

// Import Scheduled Jobs
import { startAuctionEndNotifier } from './scripts/auctionEndNotifier.js';
import { AUCTION } from './config/app.config.js';

// Import Routes
import homeRouter from './routes/home.route.js';
import productRouter from './routes/product/index.js';
import accountRouter from './routes/account/index.js';
import adminRouter from './routes/admin/index.js';
import sellerRouter from './routes/seller/index.js';

// Import Middlewares
import { isAuthenticated, isSeller, isAdmin, setAdminMode } from './middlewares/auth.mdw.js';
import apiRouter from './routes/api.route.js';

const app = express();
const PORT = process.env.PORT || 3005;

// 1. CẤU HÌNH CỐT LÕI
configureExpress(app);
configurePassport(app);

// 2. CẤU HÌNH VIEW ENGINE (Handlebars)
configureHandlebars(app);

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

app.use('/api', apiRouter);
app.use('/', homeRouter);
app.use('/products', productRouter);
app.use('/account', accountRouter);

app.listen(PORT, function () {
  console.log(`Server is running on http://localhost:${PORT}`);
  startAuctionEndNotifier(AUCTION.END_NOTIFIER_INTERVAL_SECONDS);
});
import 'dotenv/config';
import express from 'express';
import { engine } from 'express-handlebars';
import expressHandlebarsSections from 'express-handlebars-sections';
import session from 'express-session';
import methodOverride from 'method-override';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import passport from './utils/passport.js';

// Import Scheduled Jobs
import { startAuctionEndNotifier } from './scripts/auctionEndNotifier.js';

// Import Routes
import homeRouter from './routes/home.route.js';
import productRouter from './routes/product.route.js';
import accountRouter from './routes/account.route.js';
import adminCategoryRouter from './routes/admin/category.route.js';
import adminUserRouter from './routes/admin/user.route.js';
import adminAccountRouter from './routes/admin/account.route.js';
import adminProductRouter from './routes/admin/product.route.js';
import adminSystemRouter from './routes/admin/system.route.js';
import sellerRouter from './routes/seller.route.js';
// Import Middlewares
import { isAuthenticated, isSeller, isAdmin } from './middlewares/auth.mdw.js';
import * as categoryModel from './models/category.model.js';
import * as userModel from './models/user.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// ============================================================
// 1. CẤU HÌNH CỐT LÕI
// ============================================================
app.use('/static', express.static('public'));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(methodOverride('_method'));
app.use(session({
  secret: 'x8w3v9p2q1r7s6t5u4z0a8b7c6d5e4f3g2h1j9k8l7m6n5o4p3q2r1s0t9u8v7w6x5y4z3',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // false chạy localhost
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// ============================================================
// 2. CẤU HÌNH VIEW ENGINE (Handlebars)
// ============================================================
app.engine('handlebars', engine({
  defaultLayout: 'main',
  helpers: {
    section: expressHandlebarsSections(),
    eq(a, b) { return a === b; },
    add(a, b) { return a + b; },
    format_number(price) { return new Intl.NumberFormat('en-US').format(price); },
    mask_name(fullname) {
      if (!fullname) return null;
      const name = fullname.trim();
      if (name.length === 0) return null;
      if (name.length === 1) return '*';
      if (name.length === 2) return name[0] + '*';
      
      // Mã hóa xen kẽ: giữ ký tự ở vị trí chẵn (0,2,4...), thay bằng * ở vị trí lẻ (1,3,5...)
      // Khoảng trắng cũng được xử lý như ký tự bình thường
      let masked = '';
      for (let i = 0; i < name.length; i++) {
        if (i % 2 === 0) {
          masked += name[i]; // Giữ nguyên ký tự ở vị trí chẵn (kể cả khoảng trắng)
        } else {
          masked += '*'; // Thay bằng * ở vị trí lẻ
        }
      }
      return masked;
    },
    truncate(str, len) {
      if (!str) return '';
      if (str.length <= len) return str;
      return str.substring(0, len) + '...';
    },
    format_date(date) {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');
      const second = String(d.getSeconds()).padStart(2, '0');

      return `${hour}:${minute}:${second} ${day}/${month}/${year}`;
    },
    format_only_date(date) {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      return `${day}/${month}/${year}`;
    },
    format_only_time(time) {
      if (!time) return '';
      const d = new Date(time);
      if (isNaN(d.getTime())) return '';

      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');
      const second = String(d.getSeconds()).padStart(2, '0');

      return `${hour}:${minute}:${second}`;
    },
    format_date_input: function (date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    time_remaining(date) {
      const now = new Date();
      const end = new Date(date);
      const diff = end - now;
      if (diff <= 0) return '00:00:00';
      const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0');
      const minutes = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
      const seconds = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    },
    format_time_remaining(date) {
      const now = new Date();
      const end = new Date(date);
      console.log(end);
      const diff = end - now;
      
      if (diff <= 0) return 'Auction Ended';
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      // > 3 ngày: hiển thị ngày kết thúc
      if (days > 3) {
        if (isNaN(end.getTime())) return '';
        const year = end.getFullYear();
        const month = String(end.getMonth() + 1).padStart(2, '0');
        const day = String(end.getDate()).padStart(2, '0');

        const hour = String(end.getHours()).padStart(2, '0');
        const minute = String(end.getMinutes()).padStart(2, '0');
        const second = String(end.getSeconds()).padStart(2, '0');
        return `${hour}:${minute}:${second} ${day}/${month}/${year}`
      }
      
      // <= 3 ngày: hiển thị ... days left
      if (days >= 1) {
        return `${days} days left`;
      }
      
      // < 1 ngày: hiển thị ... hours left
      if (hours >= 1) {
        return `${hours} hours left`;
      }
      
      // < 1 giờ: hiển thị ... minutes left
      if (minutes >= 1) {
        return `${minutes} minutes left`;
      }
      
      // < 1 phút: hiển thị ... seconds left
      return `${seconds} seconds left`;
    },
    should_show_relative_time(date) {
      const now = new Date();
      const end = new Date(date);
      const diff = end - now;
      
      if (diff <= 0) return true; // Auction Ended counts as relative
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      return days <= 3; // True nếu <= 3 ngày (hiển thị relative time)
    },
    getPaginationRange(currentPage, totalPages) {
      const range = [];
      const maxVisible = 4;
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) range.push({ number: i, type: 'number' });
      } else {
        range.push({ number: 1, type: 'number' });
        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);
        if (start > 2) range.push({ type: 'ellipsis' });
        for (let i = start; i <= end; i++) range.push({ number: i, type: 'number' });
        if (end < totalPages - 1) range.push({ type: 'ellipsis' });
        range.push({ number: totalPages, type: 'number' });
      }
      return range;
    },
    and(...args) { 
      return args.slice(0, -1).every(Boolean); 
    },
    or(...args) { 
      return args.slice(0, -1).some(Boolean); 
    },
    gt(a, b) { 
      return a > b; 
    },
    gte(a, b) { return a >= b; },
    lt(a, b) { 
      return a < b; 
    },
    ne(a, b) {
      return a !== b;
    },
    lte(a, b) { 
      return a <= b; 
    },
    gte(a, b) { 
      return a >= b; 
    },
    lte(a, b) { return a <= b; },
    add(a, b) { 
      return a + b; 
    },
    subtract(a, b) { 
      return a - b; },
    multiply(a, b) {
      return a * b;
    },
    replace(str, search, replaceWith) {
      if (!str) return '';
      return str.replace(new RegExp(search, 'g'), replaceWith);
    },
    range(start, end) {
      const result = [];
      for (let i = start; i < end; i++) {
        result.push(i);
      }
      return result;
    },
    round(value, decimals) {
      return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    },
    length(arr) {
      return Array.isArray(arr) ? arr.length : 0;
    },
  },
  partialsDir: [
        path.join(__dirname, 'views/partials'), 
        path.join(__dirname, 'views/vwAccount') 
  ]
}));
app.set('view engine', 'handlebars');
app.set('views', './views');

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

// ============================================================
// 3. MIDDLEWARE TOÀN CỤC (Chạy cho mọi request)
// ============================================================

// 3.1. Middleware User Info
app.use(async function (req, res, next) {
  if (typeof req.session.isAuthenticated === 'undefined') {
    req.session.isAuthenticated = false;
  }
  
  // Nếu user đã đăng nhập, kiểm tra xem thông tin có thay đổi không
  if (req.session.isAuthenticated && req.session.authUser) {
    const currentUser = await userModel.findById(req.session.authUser.id);
    
    // Nếu không tìm thấy user (bị xóa) hoặc thông tin đã thay đổi, cập nhật session
    if (!currentUser) {
      // User bị xóa, đăng xuất
      req.session.isAuthenticated = false;
      req.session.authUser = null;
    } else {
      // Cập nhật thông tin mới từ DB vào session
      req.session.authUser = {
        id: currentUser.id,
        username: currentUser.username,
        fullname: currentUser.fullname,
        email: currentUser.email,
        role: currentUser.role,
        address: currentUser.address,
        date_of_birth: currentUser.date_of_birth,
        email_verified: currentUser.email_verified,
        oauth_provider: currentUser.oauth_provider,
        oauth_id: currentUser.oauth_id
      };
    }
  }
  
  res.locals.isAuthenticated = req.session.isAuthenticated;
  res.locals.authUser = req.session.authUser;
  res.locals.isAdmin = req.session.authUser?.role === 'admin';
  res.locals.isSeller = req.session.authUser?.role === 'seller';
  next();
});

// 3.2. Middleware Category (Chỉ load cho Client)
app.use(async function (req, res, next) {
  const plist = await categoryModel.findLevel1Categories();
  const clist = await categoryModel.findLevel2Categories();
  res.locals.lcCategories1 = plist;
  res.locals.lcCategories2 = clist;
  next();
});

// ============================================================
// 4. CẤU HÌNH LOGIC ADMIN (Design Pattern)
// ============================================================

// A. Bảo mật trước tiên: Mọi route /admin/* phải qua cửa kiểm soát

app.use('/admin', isAdmin);

// B. Thiết lập giao diện Admin (Bật cờ để Layout biết đường hiển thị Sidebar)
app.use('/admin', function (req, res, next) {
    res.locals.isAdminMode = true; 
    next();
});

// // C. Redirect thông minh cho trang chủ '/'
// // Nếu là Admin mà vào trang chủ '/', tự động chuyển về Dashboard (/admin)
// // Trừ khi họ bấm nút "View Website" (có tham số ?mode=client)
// app.use('/', function(req, res, next) {
//     if (req.path === '/' && res.locals.isAdmin && req.query.mode !== 'client') {
//         return res.redirect('/admin');
//     }
//     next();
// });


// ============================================================
// 5. ROUTES
// ============================================================

// Các Route Admin
app.use('/admin/account', adminAccountRouter);
app.use('/admin/users', adminUserRouter);
app.use('/admin/categories', adminCategoryRouter);
app.use('/admin/products', adminProductRouter);
app.use('/admin/system', adminSystemRouter);
// Các Route Seller
app.use('/seller', isAuthenticated, isSeller, sellerRouter);

// API endpoint for categories (for search modal)
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await categoryModel.findAll();
    // Add level information based on parent_id
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

// Các Route Client (Đặt cuối cùng để tránh override)
app.use('/', homeRouter);
app.use('/products', productRouter);
app.use('/account', accountRouter);

app.listen(PORT, function () {
  console.log(`Server is running on http://localhost:${PORT}`);
  
  // Start scheduled jobs
  startAuctionEndNotifier(30); // Check every 30 seconds for ended auctions
});
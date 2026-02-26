# Báo cáo Refactoring dự án Online Auction

<style>
  div p {
    text-align: justify;
    text-justify: inter-word;
  }
  
  mark {
    background: none !important;
    font-family: monospace;
    color: #c0341d;
    font-weight: bold;
  }
  
  .markdown-body code{
    color: #c0341d !important;
  }
  
  div>code, h6>code, p>code, li>code, td>code {
    background-color: #fbe5e1 !important;
    font-weight: bold;
  }
</style>

:::info
**Mục đích:** Xác định những vi phạm nguyên lý `SOLID`, `KISS`, `DRY`, `YAGNI`. Đánh giá tác động và xác định hướng giải quyết.
**Tác giả:** Ngô Trần Quang Đạt
:::

## SINGLE RESPONSIBILITY PRINCIPLE
### 📌 Vị trí: `src/index.js`

**Mô tả vi phạm:**

File `index.js` vi phạm SRP nghiêm trọng khi đảm nhận **quá nhiều trách nhiệm**:

1.  **Cấu hình Express** (middleware, session, static files)
```javascript
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

```
2.  **Cấu hình View Engine** (Handlebars với 30+ helper functions)
```javascript
app.set('view engine', 'handlebars');
app.set('views', './views');;

```
3.  **Quản lý Authentication state** (middleware kiểm tra user session)
```javascript
app.use(async function (req, res, next) {
  if (typeof req.session.isAuthenticated === 'undefined') {
    req.session.isAuthenticated = false;
  }
  
  // Nếu user đã đăng nhập, kiểm tra xem thông tin có thay đổi không
  if (req.session.isAuthenticated && req.session.authUser) {
    const currentUser = await userModel.findById(req.session.authUser.id);
    ...
});

```
4.  **Quản lý Category data** (middleware load categories)
```javascript
app.use(async function (req, res, next) {
  const plist = await categoryModel.findLevel1Categories();
  const clist = await categoryModel.findLevel2Categories();
  res.locals.lcCategories1 = plist;
  res.locals.lcCategories2 = clist;
  next();
});


```
6.  **Route registration** (đăng ký tất cả routes)

```javascript
// Các Route Admin
app.use('/admin/account', adminAccountRouter);
app.use('/admin/users', adminUserRouter);
app.use('/admin/categories', adminCategoryRouter);
app.use('/admin/products', adminProductRouter);
app.use('/admin/system', adminSystemRouter);
// Các Route Seller
app.use('/seller', isAuthenticated, isSeller, sellerRouter);
...
// Các Route Client (Đặt cuối cùng để tránh override)
app.use('/', homeRouter);
app.use('/products', productRouter);
app.use('/account', accountRouter);
```
6.  **Authorization logic** (isAdmin middleware)
```javascript
// A. Bảo mật trước tiên: Mọi route /admin/* phải qua cửa kiểm soát

app.use('/admin', isAdmin);

// B. Thiết lập giao diện Admin (Bật cờ để Layout biết đường hiển thị Sidebar)
app.use('/admin', function (req, res, next) {
    res.locals.isAdminMode = true; 
    next();
});
```
7.  **File upload configuration** (multer setup)
```javascript
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
```
8.  **API endpoints** (GET /api/categories)
```
app.get("/api/categories", async (req, res) => {
    try {
        const categories = await categoryModel.findAll();
        // Add level information based on parent_id
        const categoriesWithLevel = categories.map((cat) => ({
            ...cat,
            level: cat.parent_id ? 2 : 1,
        }));
        res.json({ categories: categoriesWithLevel });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: "Failed to load categories" });
    }
});
```

9.  **Server startup** (port binding)
```
app.listen(PORT, function () {
    console.log(`Server is running on http://localhost:${PORT}`);

    // Start scheduled jobs
    startAuctionEndNotifier(30); // Check every 30 seconds for ended auctions
});
```
10. **Job scheduling** (auction end notifier)


:::danger
**Tác động tiêu cực:**

* **Khó bảo trì:** File 408 dòng, quá dài và phức tạp.
* **Khó test:** Không thể test riêng từng phần logic.
* **Khó mở rộng:** Thêm helper/middleware mới làm file càng phình to.
* **Vi phạm Separation of Concerns:** Trộn lẫn configuration, business logic, và routing.
:::

### 💡 Đề xuất cải thiện

Tách thành các module riêng biệt:

1. **Cấu hình Handlebars:** `src/config/handlebars.config.js`
2. **Middlewares:** `src/middlewares/*.mdw.js`
3. **Routes:** `Dời API endpoints qua routes`

---

### 📌 Vị trí 2: `src/routes/product.route.js` (1860 dòng)

**Mô tả vi phạm:**
`product.route.js` là một **God File** điển hình với đến **1860 dòng**, đảm nhận mọi trách nhiệm liên quan đến sản phẩm:

1. **Duyệt sản phẩm** — lọc theo category, tìm kiếm, hiển thị danh sách
2. **Chi tiết sản phẩm** — lấy thông tin, ảnh, comments, bidding history
3. **Đặt giá / Mua ngay** — xử lý toàn bộ luồng bid (450 dòng trong một handler duy nhất)
4. **Quản lý đơn hàng** — xác nhận thanh toán, vận chuyển, giao hàng
5. **Hóa đơn** — tải lên và xử lý payment/shipping invoices
6. **Đánh giá** — buyer đánh giá seller và ngược lại sau giao dịch
7. **Comment** — thêm, lấy, phân trang comment
8. **Reject bidder** — seller chặn bidder cụ thể

:::danger
**Tác động tiêu cực:**

* **Không thể phân công công việc:** Mọi thay đổi liên quan đến sản phẩm đều phải đụng vào cùng 1 file.
* **Merge conflict thường xuyên** khi nhiều người làm việc song song.
* **1860 dòng** — không thể nắm bắt toàn bộ file trong đầu khi đọc code.
:::

**💡 Đề xuất cải thiện:**
Tách ra các service để xử lí business logic
Tách thành các router/controller nhỏ theo bounded context:

```
src/routes/
  product/
    browse.route.js     — danh sách, tìm kiếm, category
    detail.route.js     — chi tiết sản phẩm
    bidding.route.js    — đặt giá, mua ngay
    order.route.js      — quản lý đơn hàng, hóa đơn
    comment.route.js    — bình luận
```

---

### 📌 Vị trí 3: `src/routes/account.route.js` (725 dòng)

**Mô tả vi phạm:**
`account.route.js` gộp chung các nhóm chức năng hoàn toàn độc lập:

1. **Authentication** — signin, signup, verify email, forgot/reset password, OAuth, OTP
2. **Profile** — xem và cập nhật thông tin cá nhân
3. **Watchlist** — xem danh sách sản phẩm yêu thích
4. **Bidding history** — xem các sản phẩm đang đấu giá
5. **Won auctions** — xem các phiên đấu giá đã thắng
6. **Ratings** — xem đánh giá nhận được
7. **Upgrade request** — gửi yêu cầu nâng cấp lên seller

:::warning
**Tác động:**

* File 725 dòng phình to theo tất cả các tính năng liên quan đến user.
* Logic xác thực (OTP, bcrypt, reCAPTCHA) lẫn lộn với logic hiển thị profile.
:::

**💡 Đề xuất cải thiện:**

```
src/routes/
  auth.route.js       — signin, signup, OTP, OAuth, forgot/reset password
  profile.route.js    — xem & cập nhật thông tin cá nhân
  bidder.route.js     — watchlist, bidding history, won auctions, ratings
```

---

### 📌 Vị trí 4: `src/routes/seller.route.js` (473 dòng)

**Mô tả vi phạm:**
`seller.route.js` đảm nhận **cả quản lý sản phẩm lẫn gửi email thông báo** trong cùng một file:

1. **Dashboard** — thống kê tổng quan
2. **CRUD sản phẩm** — thêm, xem, sửa, hủy, cập nhật mô tả
3. **File upload** — xử lý thumbnail và sub-images, rename và move files
4. **Email notification** — gửi mail cho bidder/commenter khi seller cập nhật mô tả sản phẩm
5. **Đánh giá bidder** — POST và PUT rating

:::warning
**Tác động:**

* Thay đổi logic upload ảnh phải đụng vào cùng file với logic gửi email.
* HTML template email 60+ dòng nằm thẳng trong route handler.
:::

**💡 Đề xuất cải thiện:**
Tách thành các route/service riêng biệt theo trách nhiệm:

```
src/routes/seller/
  dashboard.route.js     — thống kê tổng quan (GET /)
  product.route.js       — CRUD sản phẩm, upload ảnh
  rating.route.js        — đánh giá bidder (POST/PUT rating)
src/services/
  seller.service.js      — logic cancel auction, cập nhật mô tả
  notification.service.js — gửi email thông báo bidder/commenter
```

```javascript
// src/services/seller.service.js
export class SellerService {
    async updateDescription(productId, sellerId, description) {
        await productDescUpdateModel.addUpdate({ product_id: productId, description });
        await productModel.updateDescription(productId, description);

        // Lấy danh sách cần thông báo và giao cho NotificationService
        const bidders  = await biddingHistoryModel.getUniqueBiddersByProductId(productId);
        const commenters = await productCommentModel.getUniqueCommentersByProductId(productId);
        await notificationService.notifyDescriptionUpdated(productId, [...bidders, ...commenters]);
    }
}

// src/services/notification.service.js
export class NotificationService {
    async notifyDescriptionUpdated(productId, recipients) {
        for (const user of recipients) {
            await sendMail({
                to: user.email,
                subject: 'Product description updated',
                html: this._buildDescriptionUpdateTemplate(user, productId)
            });
        }
    }

    _buildDescriptionUpdateTemplate(user, productId) {
        // HTML template tập trung tại đây, không nằm trong route handler
        return `<div>...</div>`;
    }
}

// src/routes/seller/product.route.js — chỉ xử lý HTTP, giao logic cho service
router.post('/products/:id/update-description', async (req, res) => {
    await req.services.sellerService.updateDescription(
        req.params.id,
        req.session.authUser.id,
        req.body.description
    );
    res.redirect(`/seller/products/active`);
});
```

---

## DRY (Don't Repeat Yourself)

### 📌 Vị trí: `src/routes/account.route.js`

**Mô tả vi phạm:**
Code lặp lại logic gửi OTP qua email **4 lần** tại các function: `Forgot password`, `Resend forgot password OTP`, `Signin with unverified email`, `Resend OTP`.

```javascript
const otp = generateOtp();
const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
await userModel.createOtp({ ... });
await sendMail({ ... });

```

:::warning
**Tác động:**

* **Inconsistency risk:** Dễ quên update một trong 4 chỗ → behavior khác nhau(ví dụ như chỉnh thời gian hết hạn của Otp)
* **Code bloat:** 40+ dòng code lặp lại, file 725 dòng quá dài.
* **Bug-prone:** Sửa bug ở 1 chỗ nhưng quên 3 chỗ còn lại.
:::

**💡 Đề xuất cải thiện:**
Tạo `OTPService` để quản lý logic tập trung.

```javascript
// src/services/otp.service.js
export class OTPService {
    static async createAndSendOTP(user, purpose) {
        // ... Logic tạo và lưu OTP
        // ... Logic gửi email theo template
    }
}

// Sử dụng trong routes:
router.post('/forgot-password', async (req, res) => {
    // ...
    await OTPService.createAndSendOTP(user, 'reset_password');
    // ...
});

```

### 📌 Vị trí 2.2: `src/models/product.model.js`

**Mô tả vi phạm:**
Logic `JOIN` và `SELECT` lặp lại **10+ lần** trong các queries khác nhau (`findByCategoryId`, `searchPageByKeywords`, `findTopEnding`, v.v.).

**💡 Đề xuất cải thiện:**
Sử dụng **Query Builder Pattern** để tái sử dụng logic query cơ bản.

```javascript
class ProductQueryBuilder {
    baseQuery(userId = null) {
        return this.db('products')
            .leftJoin('users', ...)
            .leftJoin('categories', ...)
            .select(...);
    }
    
    onlyActive(query) { ... }
    applySort(query, sort) { ... }
}

```


---

### 📌 Vị trí 2.3: `src/models/order.model.js`

**Mô tả vi phạm:**
Hai hàm `findByIdWithDetails` và `findByProductIdWithDetails` có **khối JOIN và SELECT hoàn toàn giống nhau** (join 4 bảng, select ~12 cột), chỉ khác nhau ở mệnh đề `WHERE`.

```javascript
// findByIdWithDetails — WHERE orders.id = orderId
// findByProductIdWithDetails — WHERE orders.product_id = productId
// Cả hai đều lặp lại đoạn này:
db('orders')
    .leftJoin('products', 'orders.product_id', 'products.id')
    .leftJoin('users as buyer', 'orders.buyer_id', 'buyer.id')
    .leftJoin('users as seller', 'orders.seller_id', 'seller.id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .select(
        'orders.*',
        'products.name as product_name',
        'products.thumbnail as product_thumbnail',
        'products.end_at as product_end_at',
        'products.closed_at as product_closed_at',
        'categories.name as category_name',
        'buyer.id as buyer_id', 'buyer.fullname as buyer_name', 'buyer.email as buyer_email',
        'seller.id as seller_id', 'seller.fullname as seller_name', 'seller.email as seller_email'
    )

```

Ngoài ra, `findBySellerId` và `findByBuyerId` cũng lặp lại cấu trúc join `products` + một alias `users` với cùng select cơ bản.

**💡 Đề xuất cải thiện:**
Tách phần query chung thành một helper nội bộ:

```javascript
// Hàm helper dùng nội bộ trong order.model.js
function orderWithDetailsQuery() {
    return db('orders')
        .leftJoin('products', 'orders.product_id', 'products.id')
        .leftJoin('users as buyer', 'orders.buyer_id', 'buyer.id')
        .leftJoin('users as seller', 'orders.seller_id', 'seller.id')
        .leftJoin('categories', 'products.category_id', 'categories.id')
        .select(
            'orders.*',
            'products.name as product_name',
            'products.thumbnail as product_thumbnail',
            'products.end_at as product_end_at',
            'products.closed_at as product_closed_at',
            'categories.name as category_name',
            'buyer.id as buyer_id', 'buyer.fullname as buyer_name', 'buyer.email as buyer_email',
            'seller.id as seller_id', 'seller.fullname as seller_name', 'seller.email as seller_email'
        );
}

export function findByIdWithDetails(orderId) {
    return orderWithDetailsQuery().where('orders.id', orderId).first();
}

export function findByProductIdWithDetails(productId) {
    return orderWithDetailsQuery().where('orders.product_id', productId).first();
}

```

---

### 📌 Vị trí 2.4: `src/models/productComment.model.js`

**Mô tả vi phạm:**
Ba hàm `getCommentsByProductId`, `getRepliesByCommentId`, `getRepliesByCommentIds` đều lặp lại **cùng một cấu trúc JOIN `users` và SELECT** 3 lần:

```javascript
// Lặp lại 3 lần trong 3 hàm khác nhau:
.join('users', 'product_comments.user_id', 'users.id')
.select(
    'product_comments.*',
    'users.fullname as user_name',
    'users.role as user_role'
)

```

**💡 Đề xuất cải thiện:**
Tạo base query helper tái sử dụng:

```javascript
function commentWithUserQuery() {
    return db('product_comments')
        .join('users', 'product_comments.user_id', 'users.id')
        .select(
            'product_comments.*',
            'users.fullname as user_name',
            'users.role as user_role'
        );
}

export function getCommentsByProductId(productId, limit = null, offset = 0) {
    let query = commentWithUserQuery()
        .where('product_comments.product_id', productId)
        .whereNull('product_comments.parent_id')
        .orderBy('product_comments.created_at', 'desc');
    if (limit !== null) query = query.limit(limit).offset(offset);
    return query;
}

export function getRepliesByCommentId(commentId) {
    return commentWithUserQuery()
        .where('product_comments.parent_id', commentId)
        .orderBy('product_comments.created_at', 'asc');
}

```

---

### 📌 Vị trí 2.5: `src/models/autoBidding.model.js`

**Mô tả vi phạm:**
Hai hàm `getBiddingProductsByBidderId` và `getWonAuctionsByBidderId` đều lặp lại **cùng một raw SQL subquery** để đếm bid count, và cùng join `categories`:

```javascript
// Lặp lại 2 lần trong 2 hàm:
db.raw(`
    (SELECT COUNT(*) FROM bidding_history
     WHERE bidding_history.product_id = products.id) AS bid_count
`)

// Cùng join categories:
.leftJoin('categories', 'products.category_id', 'categories.id')
.select('products.*', 'categories.name as category_name', ...)

```

**💡 Đề xuất cải thiện:**
Tách raw expression thành hằng số tái sử dụng:

```javascript
const BID_COUNT_RAW = () => db.raw(`
    (SELECT COUNT(*) FROM bidding_history
     WHERE bidding_history.product_id = products.id) AS bid_count
`);

function productsWithCategoryQuery() {
    return db('products')
        .leftJoin('categories', 'products.category_id', 'categories.id')
        .select('products.*', 'categories.name as category_name', BID_COUNT_RAW());
}

```

---

### 📌 Vị trí 2.6: `src/models/invoice.model.js`

**Mô tả vi phạm:**
Hai hàm `getPaymentInvoice` và `getShippingInvoice` có **cấu trúc JOIN và SELECT hoàn toàn giống nhau**, chỉ khác nhau ở giá trị của `invoice_type`:

```javascript
// getPaymentInvoice — WHERE invoice_type = 'payment'
// getShippingInvoice — WHERE invoice_type = 'shipping'
// Cả hai lặp lại:
db('invoices')
    .leftJoin('users as issuer', 'invoices.issuer_id', 'issuer.id')
    .where('invoices.order_id', orderId)
    .where('invoices.invoice_type', /* 'payment' | 'shipping' */)
    .select('invoices.*', 'issuer.fullname as issuer_name')
    .first()

```

**💡 Đề xuất cải thiện:**
Hợp nhất thành một hàm dùng chung:

```javascript
function findInvoiceByType(orderId, type) {
    return db('invoices')
        .leftJoin('users as issuer', 'invoices.issuer_id', 'issuer.id')
        .where('invoices.order_id', orderId)
        .where('invoices.invoice_type', type)
        .select('invoices.*', 'issuer.fullname as issuer_name')
        .first();
}

export const getPaymentInvoice  = (orderId) => findInvoiceByType(orderId, 'payment');
export const getShippingInvoice = (orderId) => findInvoiceByType(orderId, 'shipping');

```

---

### 📌 Vị trí 2.7: Multer config lặp lại trong 3 route files (DRY)

**Mô tả vi phạm:**
Cấu hình `multer.diskStorage` hoàn toàn giống nhau được **copy-paste 3 lần** trong 3 file route khác nhau:

```javascript
// Lặp lại y hệt trong:
// - src/routes/seller.route.js (line 171)
// - src/routes/admin/product.route.js (line 132)
// - src/routes/product.route.js (line 1074)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });
```

**💡 Đề xuất cải thiện:**
Tách ra một module upload dùng chung:

```javascript
// src/utils/upload.js
import multer from 'multer';

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

export const upload = multer({ storage });

// Trong mọi route file, thay bằng:
import { upload } from '../utils/upload.js';
```

---

### 📌 Vị trí 2.8: Logic move/rename ảnh sản phẩm lặp lại (DRY)

**Mô tả vi phạm:**
Logic xử lý file ảnh sản phẩm sau upload (rename + move thumbnail và sub-images từ `uploads/` sang `images/products/`) được **copy-paste y hệt** giữa `seller.route.js` (POST `/products/add`) và `admin/product.route.js` (POST `/add`):

```javascript
// Lặp lại ở cả 2 file:
const mainPath = path.join(dirPath, `p${returnedID[0].id}_thumb.jpg`)...;
const oldMainPath = path.join('public', 'uploads', path.basename(product.thumbnail))...;
fs.renameSync(oldMainPath, mainPath);
await productModel.updateProductThumbnail(returnedID[0].id, savedMainPath);

let i = 1;
for (const imgPath of imgs) {
    const oldPath = path.join('public', 'uploads', path.basename(imgPath))...;
    const newPath = path.join(dirPath, `p${returnedID[0].id}_${i}.jpg`)...;
    fs.renameSync(oldPath, newPath);
    i++;
}
await productModel.addProductImages(newImgPaths);
```

**💡 Đề xuất cải thiện:**
Tách thành một hàm helper hoặc service:

```javascript
// src/utils/productImageHelper.js
export async function moveProductImages(productId, thumbnail, imgsList) {
    // Di chuyển thumbnail
    // Di chuyển sub-images
    // Trả về { thumbnailPath, imagePaths }
}
```

---

### 📌 Vị trí 2.9: Bcrypt salt rounds hardcoded lặp lại (DRY)

**Mô tả vi phạm:**
Giá trị salt rounds `10` được hardcode lặp lại **4 lần** ở các file khác nhau:

```javascript
// account.route.js — signup
bcrypt.hashSync(req.body.password, 10);

// account.route.js — profile update
bcrypt.hashSync(new_password, 10);

// admin/user.route.js — add user
bcrypt.hash(password, 10);

// admin/user.route.js — reset password
bcrypt.hash(defaultPassword, 10);
```

:::warning
**Tác động:** Muốn tăng security bằng cách nâng salt rounds lên 12 phải tìm và sửa ở 4 chỗ.
:::

**💡 Đề xuất cải thiện:**

```javascript
// src/utils/password.js
const SALT_ROUNDS = 10;
export const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);
export const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);
```

---

## DEPENDENCY INVERSION PRINCIPLE (DIP)

### 📌 Vị trí: `src/routes/account.route.js`, `src/routes/product.route.js`

**Mô tả vi phạm:**
Routes phụ thuộc **trực tiếp** vào implementations cụ thể (models, utils), không dùng abstractions.

```javascript
// account.route.js
import * as userModel from '../models/user.model.js'; // Direct coupling
import { sendMail } from '../utils/mailer.js';        // Direct coupling

router.post('/signin', async function (req, res) {
    const user = await userModel.findByEmail(email);  
    await sendMail({ ... });
});

```

:::danger
**Vấn đề:**

* **Hard to test:** Không thể mock dependencies dễ dàng.
* **Tight coupling:** Thay đổi model signature → phải sửa nhiều routes.
* **Violates Open/Closed:** Không thể thay đổi implementation mà không sửa routes.
:::

**💡 Đề xuất cải thiện:**
Tách logic nghiệp vụ ra **Service Layer**, inject vào route qua một middleware đơn giản.

1. **Service:** `UserService` tập trung toàn bộ logic xác thực, ẩn đi model và mailer.
2. **Middleware:** `injectServices.mdw.js` tạo các service instance và gắn vào `req.services`.
3. **Route:** Chỉ gọi service, không còn biết đến model hay mailer.

```javascript
// src/services/user.service.js
export class UserService {
    async authenticate(email, password) {
        const user = await userModel.findByEmail(email);
        // ... kiểm tra password, gửi mail OTP nếu chưa verify ...
        return { success: true, user };
    }
}

// src/middlewares/injectServices.mdw.js
import { UserService } from '../services/user.service.js';
const userService = new UserService(); // singleton

export function injectServices(req, res, next) {
    req.services = { userService };
    next();
}

// src/routes/account.route.js  — route không còn import model hay mailer
router.post('/signin', async function (req, res) {
    const result = await req.services.userService.authenticate(email, password);
    // ...
});
```

---

### 📌 Vị trí 2: `src/routes/product.route.js` — Direct DB Access trong Route

**Mô tả vi phạm:**
Ngoài việc import trực tiếp 12 models + `sendMail`, `product.route.js` còn vi phạm DIP ở mức **nghiêm trọng hơn**: import và gọi thẳng instance `db` (Knex) bên trong route handler, **hoàn toàn bỏ qua cả tầng model**:

```javascript
// product.route.js — line 18
import db from '../utils/db.js'; // Route biết chi tiết DB client

// Trong route handler /bid (line 343):
const result = await db.transaction(async (trx) => {
    const product = await trx('products')
        .where('id', productId)
        .forUpdate()
        .first();
    // ... 450 dòng logic nghiệp vụ + SQL trực tiếp ...
});

// Trong route handler /order/:orderId/submit-rating (line 1286):
await db('products').where('id', order.product_id).update({
    is_sold: true,
    closed_at: new Date()
});

// Tương tự tại lines 1338, 1437, 1671...
```

:::danger
**Tác động:**

* **Worst-case DIP violation:** Route layer biết cả schema DB (tên bảng, tên cột), không chỉ biết model API.
* **Zero abstraction:** Không thể swap sang ORM khác hay database khác mà không phải sửa routes.
* **Untestable:** Phải mock Knex instance để test route — cực kỳ phức tạp.
:::

**💡 Đề xuất cải thiện:**
Chuyển toàn bộ `db.*` call trong route vào đúng model tương ứng:

```javascript
// product.model.js — thêm hàm còn thiếu
export async function markAsSold(productId, trx = db) {
    return trx('products').where('id', productId).update({
        is_sold: true,
        closed_at: new Date()
    });
}

// Trong route — không còn biết đến db
await productModel.markAsSold(order.product_id);
```

---

### 📌 Vị trí 3: `src/routes/seller.route.js`

**Mô tả vi phạm:**
`seller.route.js` import trực tiếp **5 models** và **`sendMail`**, nhúng toàn bộ logic nghiệp vụ của seller (quản lý sản phẩm, cancel auction, gửi email thông báo bidder) vào tầng route:

```javascript
import * as productModel           from '../models/product.model.js';
import * as reviewModel            from '../models/review.model.js';
import * as productDescUpdateModel from '../models/productDescriptionUpdate.model.js';
import * as biddingHistoryModel    from '../models/biddingHistory.model.js';
import * as productCommentModel    from '../models/productComment.model.js';
import { sendMail } from '../utils/mailer.js';                             // Direct coupling
```

:::warning
**Tác động:**

* **Seller route biết quá nhiều:** Một thay đổi nhỏ ở signature của bất kỳ model nào cũng buộc phải sửa route.
* **Business logic rải rác:** Logic "cancel auction → gửi email tất cả bidder" nằm ngay trong route handler thay vì trong một `SellerService`.
:::

**💡 Đề xuất cải thiện:**
Tách logic ra `SellerService`:

```javascript
// src/services/seller.service.js
export class SellerService {
    async cancelAuction(productId, sellerId) {
        // Kiểm tra quyền sở hữu, cancel product, lấy danh sách bidder, gửi mail
    }
    async addProduct(sellerId, productData, imageFiles) { ... }
}

// seller.route.js — chỉ gọi service
router.post('/products/cancel', async (req, res) => {
    await req.services.sellerService.cancelAuction(productId, sellerId);
    res.redirect('/seller/products/pending');
});
```

---

### 📌 Vị trí 4: `src/routes/admin/user.route.js`

**Mô tả vi phạm:**
Route admin quản lý user import trực tiếp `upgradeRequestModel`, `userModel`, `sendMail` và tự xử lý toàn bộ logic nghiệp vụ phê duyệt/từ chối nâng cấp tài khoản ngay trong route handler:

```javascript
import * as upgradeRequestModel from '../../models/upgradeRequest.model.js';
import * as userModel           from '../../models/user.model.js';
import { sendMail }             from '../../utils/mailer.js';              // Direct coupling

router.post('/upgrade-requests/:id/approve', async (req, res) => {
    await upgradeRequestModel.approveUpgradeRequest(id);
    await userModel.update(userId, { role: 'seller' });
    await sendMail({ to: user.email, subject: 'Account upgraded', ... });
});
```

:::warning
**Tác động:**

* Logic nghiệp vụ (approve → update role → gửi email) bị nhúng trực tiếp vào route, không thể tái sử dụng ở nơi khác (VD: auto-approve theo schedule).
* Thay đổi flow approve (thêm bước kiểm tra) phải sửa thẳng vào route.
:::

**💡 Đề xuất cải thiện:**

```javascript
// src/services/admin.service.js
export class AdminService {
    async approveUpgrade(requestId) {
        const request = await upgradeRequestModel.findById(requestId);
        await upgradeRequestModel.approveUpgradeRequest(requestId);
        await userModel.update(request.bidder_id, { role: 'seller' });
        await sendMail({ to: ..., subject: 'Account upgraded', ... });
    }
}

// admin/user.route.js — route không còn phụ thuộc model hay mailer
router.post('/upgrade-requests/:id/approve', async (req, res) => {
    await req.services.adminService.approveUpgrade(req.params.id);
    res.redirect('/admin/users/upgrade-requests');
});
```

---

### 📌 Vị trí 5: `src/scripts/auctionEndNotifier.js`

**Mô tả vi phạm:**
Script cron job import trực tiếp `productModel` và `sendMail`, trộn lẫn logic nghiệp vụ (xác định đấu giá kết thúc, quyết định ai cần thông báo) với chi tiết triển khai (nội dung HTML email):

```javascript
import * as productModel from '../models/product.model.js'; // Direct coupling
import { sendMail } from '../utils/mailer.js';              // Direct coupling

export async function checkAndNotifyEndedAuctions() {
    const endedAuctions = await productModel.getNewlyEndedAuctions();
    for (const auction of endedAuctions) {
        if (auction.winner_email) {
            await sendMail({
                to: auction.winner_email,
                html: `<div style="...">...</div>` // 80+ dòng HTML template cứng trong business logic
            });
        }
    }
}
```

:::warning
**Tác động:**

* **No abstraction for notification:** Nếu muốn chuyển từ email sang push notification, phải sửa trực tiếp vào script.
* **Email template cứng trong business logic:** HTML dài 80+ dòng lẫn giữa logic điều phối thông báo.
* **Không thể test:** Phải mock cả `productModel` lẫn `sendMail` để test logic phân loại thông báo.
:::

**💡 Đề xuất cải thiện:**
Tách thành `NotificationService` với interface rõ ràng:

```javascript
// src/services/notification.service.js
export class NotificationService {
    async notifyAuctionWinner(auction) { ... }
    async notifyAuctionSeller(auction) { ... }
    async notifyOutbidBidder(auction, previousBidderId) { ... }
}

// src/scripts/auctionEndNotifier.js — chỉ orchestrate, không biết cách gửi mail
import { NotificationService } from '../services/notification.service.js';
const notifier = new NotificationService();

export async function checkAndNotifyEndedAuctions() {
    const endedAuctions = await auctionService.getNewlyEnded();
    for (const auction of endedAuctions) {
        await notifier.notifyAuctionWinner(auction);
        await notifier.notifyAuctionSeller(auction);
    }
}
```

---

## OPEN/CLOSED PRINCIPLE (OCP)

### 📌 Vị trí: `src/routes/product.route.js` (Lines 336-788)

**Mô tả vi phạm:**
Route `/bid` là một **God Function** với **450 dòng code**. Để thêm tính năng mới (VD: bid bằng crypto, chặn user rating thấp), phải sửa trực tiếp vào hàm này.

:::warning
**Tác động:**

* **Cannot extend without modification:** Vi phạm OCP.
* **High risk of bugs:** Sửa logic này dễ làm hỏng logic kia.
* **Khó test:** 450 dòng logic lồng nhau rất khó viết unit test.
:::

**💡 Đề xuất cải thiện:**
Áp dụng **Strategy Pattern** (cho Validation) và **Chain of Responsibility** (cho Processing).

```javascript
// Orchestrator
export class BiddingService {
    constructor() {
        this.validators = [
            new SellerBidValidator(),
            new RatingValidator(), // Dễ dàng thêm validator mới
            new BidAmountValidator()
        ];
        this.processors = [
            new AutomaticBiddingProcessor(),
            new BuyNowProcessor()
        ];
    }
    
    async placeBid(userId, productId, bidAmount) {
        // Run validators
        for (const validator of this.validators) await validator.validate(ctx);
        
        // Run processors
        for (const processor of this.processors) await processor.process(ctx);
    }
}

```

---

## KISS (Keep It Simple, Stupid)

### 📌 Vị trí 1: `src/middlewares/auth.mdw.js`

**Mô tả vi phạm:**
Middleware authentication có lỗi tiềm ẩn vì không kiểm tra null, gây crash server.

```javascript
export function isSeller(req, res, next) {
    // ❌ Crash nếu authUser null (chưa login hoặc session hết hạn)
    if (req.session.authUser.role === "seller") { 
        next();
    }
}

```

**💡 Đề xuất cải thiện:**
Sử dụng Optional Chaining (`?.`) và xử lý edge cases.

```javascript
export function isSeller(req, res, next) {
    if (req.session?.authUser?.role === "seller") {
        next();
    } else {
        res.redirect('/account/signin'); // Handle gracefully
    }
}

```

---

### 📌 Vị trí 2: `src/index.js` — DB query trên mọi request

**Mô tả vi phạm:**
Global middleware trong `index.js` gọi `userModel.findById()` trên **mọi HTTP request** (kể cả request tĩnh như CSS, JS) để đồng bộ thông tin user với DB:

```javascript
// src/index.js — chạy cho MỌI request
app.use(async function (req, res, next) {
    if (req.session.isAuthenticated && req.session.authUser) {
        // ❌ Mỗi request (kể cả /static/css/*.css) đều hit database
        const currentUser = await userModel.findById(req.session.authUser.id);
        req.session.authUser = { ...currentUser };
    }
    next();
});
```

:::danger
**Tác động:**

* **Performance:** Với 10 assets trên 1 trang → 10 DB queries chỉ để tải trang.
* **Over-engineering:** Thông tin user session thay đổi rất ít, không cần đồng bộ trên mọi request.
:::

**💡 Đề xuất cải thiện:**
Chỉ refresh session khi cần thiết (ví dụ: mỗi 60 giây hoặc sau khi có thay đổi profile):

```javascript
app.use(async function (req, res, next) {
    // Bỏ qua static assets
    if (req.path.startsWith('/static')) return next();
    
    if (req.session.isAuthenticated && req.session.authUser) {
        const lastRefresh = req.session.userLastRefresh || 0;
        // Chỉ hit DB nếu đã quá 60s kể từ lần cuối
        if (Date.now() - lastRefresh > 60_000) {
            const currentUser = await userModel.findById(req.session.authUser.id);
            req.session.authUser = { ...currentUser };
            req.session.userLastRefresh = Date.now();
        }
    }
    next();
});
```

---

### 📌 Vị trí 3: `src/routes/account.route.js` — Inline reCAPTCHA verification

**Mô tả vi phạm:**
Logic xác minh reCAPTCHA (gọi Google API, parse JSON, kiểm tra `data.success`) được nhúng **trực tiếp** vào route handler POST `/signup`, làm handler trở nên dài và khó đọc:

```javascript
// account.route.js (trong POST /signup)
const secretKey = process.env.RECAPTCHA_SECRET;
const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?...`;
try {
    const response = await fetch(verifyUrl, { method: 'POST' });
    const data = await response.json();
    if (!data.success) errors.captcha = 'Captcha verification failed.';
} catch (err) {
    errors.captcha = 'Error connecting to captcha server.';
}
```

**💡 Đề xuất cải thiện:**
Tách ra một util function:

```javascript
// src/utils/recaptcha.js
export async function verifyRecaptcha(token) {
    if (!token) return false;
    const url = `https://www.google.com/recaptcha/api/siteverify`;
    const resp = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET, response: token })
    });
    const data = await resp.json();
    return data.success;
}

// Trong route:
const isHuman = await verifyRecaptcha(req.body['g-recaptcha-response']);
if (!isHuman) errors.captcha = 'Captcha verification failed.';
```

---

## CÁC VI PHẠM KHÁC (Minor)

### 🔁 Duplicate Helper Functions (DRY)

* **Vị trí:** `src/index.js`
* **Mô tả:** Các hàm `add`, `gte`, `lte` được định nghĩa lặp lại 2 lần trong cùng một object helpers.
* **Giải quyết:** Xóa bỏ các hàm trùng lặp, giữ lại 1 version duy nhất.

### 🗑️ Dead Code — Commented-out redirect (YAGNI)

* **Vị trí:** `src/index.js` (Lines 391-399)
* **Mô tả:** Code redirect admin bị comment out nhưng không xóa.
* **Giải quyết:** Xóa hoàn toàn. Sử dụng Git history nếu cần khôi phục sau này.

### 🗑️ Dynamic import cho module đã được import tĩnh (YAGNI)

* **Vị trí:** `src/routes/seller.route.js` (POST `/products/:id/cancel`)
* **Mô tả:** Route handler dùng `await import('../models/review.model.js')` trong runtime, trong khi `reviewModel` đã được **import tĩnh ở đầu file** (line 3). Dynamic import thừa hoàn toàn và gây nhầm lẫn.

```javascript
// Line 3 — đã import tĩnh
import * as reviewModel from '../models/review.model.js';

// Trong route handler — thừa, import lại cùng module
const reviewModule = await import('../models/review.model.js'); // ❌
await reviewModule.createReview(reviewData);

// Đúng phải là:
await reviewModel.createReview(reviewData); // ✅
```

* **Giải quyết:** Xóa dynamic import, dùng trực tiếp biến `reviewModel` đã có.

### 🗑️ Debug `console.log` trong production code (YAGNI)

* **Vị trí:** Rải rác khắp codebase — `seller.route.js`, `admin/product.route.js`, `account.route.js`, `index.js`.
* **Mô tả:** Hàng chục `console.log` debug được để lại trong code production:

```javascript
// seller.route.js
console.log('productData:', productData);
console.log('subimagesData:', newImgPaths);

// account.route.js
console.log(hashedPassword);
console.log('User id: ', newUser.id, ' OTP: ', otp);

// index.js — trong Handlebars helper
console.log(end);
```

* **Giải quyết:** Xóa toàn bộ. Nếu cần logging, dùng thư viện như `winston` hoặc `pino` với log levels (`debug`, `info`, `error`) để tắt log ở production.

---
### 🗑️ Import thừa (YAGNI)

* **Vị trí: src/index.js.
* **Mô tả:** Nhiều dòng import thừa ở đầu file.

```javascript
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
```

* **Giải quyết:** Xóa toàn bộ. 
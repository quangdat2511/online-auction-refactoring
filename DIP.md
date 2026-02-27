DIP (Dependency Inversion Principle) — Kiểm tra `src_origin`

Tóm tắt: tìm thấy nhiều vi phạm DIP — các module bậc cao (routes) phụ thuộc trực tiếp vào module bậc thấp (models, utils), thiếu abstraction/interface layer và dependency injection.

Vi phạm chính

1. **Routes phụ thuộc trực tiếp vào Models (tightly coupled)**
   - Vị trí: Toàn bộ route files (`routes/account.route.js`, `routes/seller.route.js`, `routes/product.route.js`, `routes/admin/*.route.js`)
   - Ví dụ: 
     ```javascript
     // account.route.js
     import * as userModel from '../models/user.model.js';
     import * as reviewModel from '../models/review.model.js';
     import * as autoBiddingModel from '../models/autoBidding.model.js';
     
     // Gọi trực tiếp mà không có abstraction
     await userModel.findByEmail(email);
     await reviewModel.calculateRatingPoint(currentUserId);
     ```
   - Vấn đề: 
     - Routes (high-level) phụ thuộc vào Models (low-level) — vi phạm DIP
     - Nếu thay đổi data source (từ SQL sang NoSQL) phải sửa tất cả routes
     - Khó test (không thể mock models dễ)
     - Model bị import ở nhiều nơi → "many to one" dependency → khó bảo trì
   - Khuyến nghị: tạo **Service/Repository layer** giữa routes và models. Routes phụ thuộc vào service interface, service gọi models.

2. **Routes phụ thuộc trực tiếp vào Utils (sendMail, passport, db, ...)**
   - Vị trí: import trực tiếp trong routes
     - `sendMail` được import ở: `account.route.js`, `seller.route.js`, `product.route.js`, `admin/user.route.js`, `scripts/auctionEndNotifier.js`
     - `passport` được import ở: `account.route.js`
     - `db` được import ở: `product.route.js`
   - Ví dụ:
     ```javascript
     // product.route.js
     import { sendMail } from '../utils/mailer.js';
     import db from '../utils/db.js';
     
     // Dùng trực tiếp không có abstraction
     await sendMail({ to, subject, html });
     const trx = await db.transaction();
     ```
   - Vấn đề:
     - Routes phụ thuộc vào concrete utility implementations
     - Khó swap/mock utils (ví dụ: thay AWS SES thay vì nodemailer)
     - Business logic (email sending) ở route handlers → violates SRP + DIP
     - Multiple routes tightly coupled vào cùng một utility
   - Khuyến nghị: 
     - Tạo Service classes (ví dụ: `NotificationService`, `UserService`) nhận dependencies qua constructor
     - Routes phụ thuộc vào service interface, không vào concrete utils
     - Implement dependency injection container (DI container) hoặc factory

3. **Passportjs không tuân DIP**
   - Vị trí: `src_origin/utils/passport.js` lines 24, 69, 110
   - Ví dụ:
     ```javascript
     passport.use(new GoogleStrategy({...}));
     passport.use(new FacebookStrategy({...}));
     passport.use(new GitHubStrategy({...}));
     ```
   - Vấn đề:
     - Trực tiếp instantiate concrete strategy classes
     - Cấu hình strategy cứng (hardcoded) trong file — không flexible
     - Khó thêm strategy mới mà không sửa file này
   - Khuyến nghị: dùng strategy registry pattern hoặc config-driven setup để add strategies từ config file

4. **Business logic phân tán ở Route handlers (violates Single Responsibility)**
   - Vị trí: `account.route.js`, `seller.route.js`, `product.route.js` — route handlers chứa:
     - Email sending logic (sendMail với HTML template inline)
     - OTP generation & validation
     - Password reset flow
     - Bidding logic, payment logic, etc.
   - Ví dụ:
     ```javascript
     router.post('/forgot-password', async (req, res) => {
       const otp = generateOtp();
       await userModel.createOtp({...});
       await sendMail({...}); // Business logic ở route
       // ...
     });
     ```
   - Vấn đề:
     - Routes chứa business logic → tight coupling logic với HTTP
     - Khó test business logic độc lập (phải mock req/res)
     - Violates DIP: route phụ thuộc vào sendMail utility directly
     - Violates SRP: route handler vừa xử lý HTTP vừa business logic
   - Khuyến nghị:
     - Tạo service classes (ví dụ: `AuthService`, `PasswordResetService`)
     - Service classes chứa business logic, nhận dependencies qua constructor
     - Routes gọi service methods, service gọi models/utils

5. **Không có interface/abstraction layer**
   - Vị trí: toàn bộ app
   - Vấn đề: 
     - Routes import concrete models → phụ thuộc vào implementation
     - Utils là concrete implementations không có interface
     - Khó swap implementations (mock, test, v.v.)
   - Khuyến nghị:
     - Tạo abstraction: interface/abstract class cho mỗi repository (ví dụ: `IUserRepository`, `IProductRepository`)
     - Tạo abstraction cho services (ví dụ: `IEmailService`, `IAuthService`)
     - Routes phụ thuộc vào interface, không vào concrete class

Những lối sửa khuyến nghị

```
Hiện tại (vi phạm DIP):
Route → Model → DB
Route → Utils (sendMail, passport, etc.)

Nên thay bằng:
Route → Service (interface) → Model → DB
Route → Service (interface) → Utils
Route → Repository (interface) → Model → DB
```

Ưu tiên sửa hạng

1. **Cao (critical)**: Routes → Service abstraction (remove direct model/utils imports)
2. **Trung**: Tạo Repository pattern cho Model layer
3. **Thấp**: Refactor passport.js strategy registration thành config-driven

Ví dụ refactor nhỏ

**Trước:**
```javascript
// product.route.js
import * as productModel from '../models/product.model.js';
import { sendMail } from '../utils/mailer.js';

router.post('/bid', async (req, res) => {
  const product = await productModel.findById(req.body.productId);
  await productModel.placeBid(...);
  await sendMail({...});
});
```

**Sau:**
```javascript
// services/BiddingService.js
export class BiddingService {
  constructor(productRepository, emailService) {
    this.productRepo = productRepository;
    this.emailService = emailService;
  }
  
  async placeBid(bidderId, productId, amount) {
    const product = await this.productRepo.findById(productId);
    // business logic here
    await this.productRepo.updateBid(productId, amount);
    await this.emailService.sendBidNotification(...);
  }
}

// product.route.js
constructor(biddingService) { // Inject dependency
  this.biddingService = biddingService;
}

router.post('/bid', async (req, res) => {
  await this.biddingService.placeBid(req.session.authUser.id, ...);
  res.json({ success: true });
});
```

Tóm lại: **DIP violation chính là routes import trực tiếp models + utils** → cần tạo service layer + dependency injection để decouple high-level từ low-level implementations.

OCP (Open/Closed Principle) — Kiểm tra `src_origin`

Tóm tắt: tìm thấy một số chỗ trong `src_origin` cần cải tổ để tuân thủ OCP (mở để mở rộng, đóng để sửa đổi).

Vi phạm chính

- src_origin/models/order.model.js
  - Vị trí: hàm `updateStatus` (có `switch (newStatus) { ... }` để gán các timestamp và xử lý `cancelled`).
  - Vấn đề: khi thêm trạng thái mới hoặc muốn thay đổi hành vi chuyển trạng thái phải sửa trực tiếp hàm này — vi phạm OCP.
  - Khuyến nghị: dùng mapping trạng thái → handler (ví dụ object map hoặc lớp strategy), hoặc tách mỗi hành vi "onEnter" của trạng thái ra module riêng; dùng constants cho tên trạng thái.

- src_origin/routes/seller.route.js
  - Vị trí: đoạn kiểm tra `if (product.status === 'Cancelled' && ...)` trước khi tạo review.
  - Vấn đề: logic tuỳ theo trạng thái phân tán trong route — thêm trạng thái/đổi hành vi yêu cầu sửa nhiều nơi.
  - Khuyến nghị: đưa logic phụ thuộc trạng thái vào model (ví dụ `productModel.handleOnExpire(product)`), hoặc dùng event/hook khi chuyển trạng thái.

- src_origin/routes/product.route.js
  - Vị trí: kiểm tra `productStatus === 'PENDING'` để quyết định hiển thị/nút thanh toán.
  - Vấn đề: view/route phụ thuộc trực tiếp vào tên trạng thái.
  - Khuyến nghị: dùng helper/constant `Status.PENDING` và helper `product.isPending()` hoặc adapter view model để tránh rải string literal.

- Templates trong src_origin/views (ví dụ `views/vwProduct/details.handlebars`, `views/vwSeller/all-products.handlebars`, `views/vwSeller/pending.handlebars`)
  - Vị trí: sử dụng nhiều literal status ("PENDING", "Cancelled", ...).
  - Vấn đề: khi đổi tên trạng thái hoặc thêm trạng thái mới cần sửa nhiều template.
  - Khuyến nghị: cung cấp helper Handlebars (ví dụ `isStatus productStatus 'PENDING'`) hoặc truyền vào view một object trạng thái (enum/constants) để template chỉ kiểm tra helper/flags.

Những điểm khác cần kiểm tra thêm

- Tìm và thay thế string literal trạng thái bằng constants (`const STATUS = { PENDING: 'PENDING', ... }`) trong model/route/view.
- Tập trung tất cả chuyển trạng thái và side-effect (timestamps, ghi lịch sử, email, tạo review, v.v.) vào một service hoặc domain object `OrderService` để mở rộng mà không cần sửa logic hiện có.

Ngắn gọn: điểm nghiêm trọng nhất là `src_origin/models/order.model.js` (switch trên `newStatus`) — nên refactor sang bản đồ trạng thái → handler hoặc strategy để tuân OCP. Các route và view hiện tại dùng nhiều literal trạng thái; giảm rải string và dùng helpers/constants sẽ cải thiện tuân thủ OCP.

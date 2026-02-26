BEGIN;

-- ==========================================
-- 1. CLEAN UP & RESET IDs
-- ==========================================
TRUNCATE TABLE reviews, order_chats, orders, product_description_updates, auto_bidding, bidding_history, watchlists, product_images, products, categories, upgrade_requests, user_otps, users, system_settings RESTART IDENTITY CASCADE;

SET TIME ZONE 'Asia/Ho_Chi_Minh';

-- ==========================================
-- 2. CREATE CATEGORIES
-- ==========================================
INSERT INTO categories (name, parent_id) VALUES
('Electronics', NULL),       -- ID 1
('Mobile Phones', 1),        -- ID 2
('Laptops', 1),              -- ID 3
('Fashion', NULL),           -- ID 4
('Shoes', 4),                -- ID 5
('Watches', 4),              -- ID 6
('Home Appliances', NULL),   -- ID 7
('Kitchen Tools', 7);        -- ID 8

-- ==========================================
-- 3. CREATE USERS
-- ==========================================
INSERT INTO users (fullname, address, email, password_hash, role, email_verified) VALUES
('John Smith', '123 5th Avenue, New York, USA', 'john.admin@store.com', '$2b$10$oWF4jeeZwmCx7VeoB97az.8pH4l1oC0OG1AcbVc8vllc20AhLKaWW', 'admin', TRUE),  -- ID 1
('Sarah Jenkins', '45 Oxford Street, London, UK', 'sarah.boutique@uk.com', '$2b$10$oWF4jeeZwmCx7VeoB97az.8pH4l1oC0OG1AcbVc8vllc20AhLKaWW', 'seller', TRUE), -- ID 2
('Michael Brown', '88 George Street, Sydney, Australia', 'mike.trader@au.com', '$2b$10$oWF4jeeZwmCx7VeoB97az.8pH4l1oC0OG1AcbVc8vllc20AhLKaWW', 'seller', TRUE), -- ID 3
('David Miller', 'Beverly Hills, California, USA', 'david.vip@gmail.com', '$2b$10$oWF4jeeZwmCx7VeoB97az.8pH4l1oC0OG1AcbVc8vllc20AhLKaWW', 'bidder', TRUE), -- ID 4
('Emily Wilson', 'Toronto, Canada', 'emily.w@yahoo.com', '$2b$10$oWF4jeeZwmCx7VeoB97az.8pH4l1oC0OG1AcbVc8vllc20AhLKaWW', 'bidder', TRUE), -- ID 5
('Robert Taylor', 'Berlin, Germany', 'robert.bad@gmail.com', '$2b$10$oWF4jeeZwmCx7VeoB97az.8pH4l1oC0OG1AcbVc8vllc20AhLKaWW', 'bidder', TRUE), -- ID 6
('Jessica Davis', 'Paris, France', 'jessica.new@outlook.com', '$2b$10$oWF4jeeZwmCx7VeoB97az.8pH4l1oC0OG1AcbVc8vllc20AhLKaWW', 'bidder', TRUE), -- ID 7
('Daniel Anderson', 'Silicon Valley, USA', 'dan.tech@gmail.com', '$2b$10$oWF4jeeZwmCx7VeoB97az.8pH4l1oC0OG1AcbVc8vllc20AhLKaWW', 'bidder', TRUE), -- ID 8
('Lisa Thomas', 'Singapore', 'lisa.collector@gmail.com', '$2b$10$oWF4jeeZwmCx7VeoB97az.8pH4l1oC0OG1AcbVc8vllc20AhLKaWW', 'bidder', TRUE), -- ID 9
('James White', 'Dubai, UAE', 'james.rich@gmail.com', '$2b$10$oWF4jeeZwmCx7VeoB97az.8pH4l1oC0OG1AcbVc8vllc20AhLKaWW', 'bidder', TRUE), -- ID 10
('Seller Account 11', 'Ho Chi Minh City, Vietnam', 'seller11@auction.local', '$2b$10$oWF4jeeZwmCx7VeoB97az.8pH4l1oC0OG1AcbVc8vllc20AhLKaWW', 'seller', TRUE), -- ID 11
('Bidder Account 12', 'Ho Chi Minh City, Vietnam', 'bidder12@auction.local', '$2b$10$oWF4jeeZwmCx7VeoB97az.8pH4l1oC0OG1AcbVc8vllc20AhLKaWW', 'bidder', TRUE); -- ID 12

INSERT INTO products 
(name, category_id, seller_id, starting_price, step_price, buy_now_price, current_price, highest_bidder_id, thumbnail, created_at, end_at, auto_extend, description, allow_unrated_bidder, closed_at) 
VALUES
-- ============================================
-- === ACTIVE PRODUCTS (ID 1-25) === 
-- ============================================
('iPhone 15 Pro Max 256GB', 2, 11, 25000000, 500000, 40000000, 25000000, NULL, 'images/products/p1_thumb.jpg',
 '2025-12-05 00:00:00', '2026-05-15', TRUE, '<p>iPhone 15 Pro Max 256GB Natural Titanium. Like new condition, battery 96%. Full box with all accessories. AppleCare+ until 2026.</p>', TRUE, NULL), 

('Samsung Galaxy S24 Ultra', 2, 2, 22000000, 300000, 35000000, 22000000, NULL, 'images/products/p2_thumb.jpg',
 '2025-12-06', '2026-06-01', TRUE, '<p>Samsung Galaxy S24 Ultra 512GB Titanium Black. S-Pen included. Official warranty 11 months remaining.</p>', TRUE, NULL),

('iPhone 14 128GB', 2, 3, 12000000, 200000, 20000000, 12000000, NULL, 'images/products/p3_thumb.jpg',
 '2025-12-07', '2026-07-20', FALSE, '<p>iPhone 14 128GB Blue. Excellent condition, battery 92%. Full box with charger and cable.</p>', TRUE, NULL),

('Samsung Galaxy A54 5G', 2, 2, 6000000, 100000, 10000000, 6000000, NULL, 'images/products/p4_thumb.jpg',
 '2025-12-05', '2026-05-10', TRUE, '<p>Samsung Galaxy A54 5G 256GB. Water resistant IP67. Awesome camera for the price.</p>',  TRUE, NULL),

('iPhone 13 Mini 128GB', 2, 2, 8000000, 200000, 14000000, 8000000, NULL, 'images/products/p5_thumb.jpg',
 '2025-12-04', '2026-08-15', TRUE, '<p>iPhone 13 Mini 128GB Pink. Compact flagship phone. Perfect for one-hand use. Battery 89%.</p>', TRUE, NULL),

('MacBook Air M2 2022', 3, 3, 22000000, 400000, 35000000, 22000000, NULL, 'images/products/p6_thumb.jpg',
 '2025-12-01', '2026-09-30', TRUE, '<p>MacBook Air M2 8GB RAM, 256GB SSD, Midnight color. Cycle count: 45. AppleCare+ included.</p>', FALSE, NULL),

('Dell Inspiron 15 3520', 3, 3, 10000000, 200000, 18000000, 10000000, NULL, 'images/products/p7_thumb.jpg',
 '2025-12-08', '2026-10-28', FALSE, '<p>Dell Inspiron 15 - Intel Core i5-1235U, 8GB RAM, 512GB SSD. Great for students and office work.</p>', FALSE, NULL),

('HP Pavilion Gaming 15', 3, 2, 15000000, 300000, 25000000, 15000000, NULL, 'images/products/p8_thumb.jpg',
 '2025-12-02', '2026-06-25', TRUE, '<p>HP Pavilion Gaming 15 - Intel i7, RTX 3050, 16GB RAM. Perfect entry-level gaming laptop.</p>', TRUE, NULL),

('Asus VivoBook 15 OLED', 3, 3, 12000000, 200000, 20000000, 12000000, NULL, 'images/products/p9_thumb.jpg',
 '2025-12-03', '2026-07-10', TRUE, '<p>Asus VivoBook 15 OLED - Ryzen 5 5600H, 16GB RAM. Stunning OLED display for content creators.</p>',  TRUE, NULL),

('Lenovo ThinkPad E14 Gen 5', 3, 11, 14000000, 200000, 24000000, 14000000, NULL, 'images/products/p10_thumb.jpg',
 '2025-12-01', '2026-11-01', TRUE, '<p>Lenovo ThinkPad E14 - Intel i5 Gen 13, 16GB RAM. Legendary keyboard, built for business professionals.</p>', TRUE, NULL),

('Apple AirPods Pro 2nd Gen', 1, 2, 4000000, 100000, 7000000, 4000000, NULL, 'images/products/p11_thumb.jpg',
 '2025-12-10', '2026-05-20', TRUE, '<p>Apple AirPods Pro 2nd Generation with USB-C. Active Noise Cancellation. Full box sealed.</p>', TRUE, NULL),

('Sony WH-1000XM5 Headphones', 1, 3, 5000000, 100000, 9000000, 5000000, NULL, 'images/products/p12_thumb.jpg',
 '2025-12-11', '2026-06-15', TRUE, '<p>Sony WH-1000XM5 Wireless Headphones Black. Industry-leading noise cancellation. 30-hour battery.</p>', FALSE, NULL),

('Apple iPad Air 5 M1', 1, 2, 12000000, 200000, 20000000, 12000000, NULL, 'images/products/p13_thumb.jpg',
 '2025-12-12', '2026-08-30', TRUE, '<p>iPad Air 5 M1 chip 64GB WiFi Space Gray. Works with Apple Pencil 2nd gen. Perfect for artists.</p>',  TRUE, NULL),

('Nike Air Force 1 Low White', 5, 2, 2000000, 50000, 4000000, 2000000, NULL, 'images/products/p14_thumb.jpg',
 '2025-12-13', '2026-09-20', TRUE, '<p>Nike Air Force 1 07 Low White. Size 42. Deadstock, brand new with box. Classic sneaker.</p>',  TRUE, NULL),

('Apple Watch Series 9 GPS', 6, 3, 8000000, 200000, 14000000, 8000000, NULL, 'images/products/p15_thumb.jpg',
 '2025-12-14', '2026-06-30', TRUE, '<p>Apple Watch Series 9 GPS 45mm Midnight Aluminum. Blood oxygen, ECG features. Full box.</p>',  FALSE, NULL),

('Samsung Galaxy Tab S9', 1, 3, 15000000, 300000, 25000000, 15000000, NULL, 'images/products/p16_thumb.jpg',
 '2025-12-15', '2026-07-15', TRUE, '<p>Samsung Galaxy Tab S9 128GB WiFi. S-Pen included. AMOLED display 120Hz. Great for productivity.</p>', FALSE, NULL),

('Canon EOS R50 Mirrorless', 1, 2, 18000000, 300000, 28000000, 18000000, NULL, 'images/products/p17_thumb.jpg',
 '2025-12-16', '2026-08-20', TRUE, '<p>Canon EOS R50 with RF-S 18-45mm lens. 24.2MP APS-C sensor. Perfect for beginners and vloggers.</p>', TRUE, NULL),

('Adidas Ultraboost Light', 5, 2, 3000000, 50000, 5500000, 3000000, NULL, 'images/products/p18_thumb.jpg',
 '2025-12-17', '2026-09-10', TRUE, '<p>Adidas Ultraboost Light running shoes. Size 43. Brand new, never worn. Best comfort for running.</p>', TRUE, NULL),

('Casio G-Shock GA-2100', 6, 2, 2500000, 50000, 4500000, 2500000, NULL, 'images/products/p19_thumb.jpg',
 '2025-12-18', '2026-10-05', TRUE, '<p>Casio G-Shock GA-2100-1A1 CasiOak. Carbon Core Guard. Water resistant 200m. Full box.</p>',  TRUE, NULL),

('Sony PlayStation 5 Slim', 1, 3, 12000000, 300000, 18000000, 12000000, NULL, 'images/products/p20_thumb.jpg',
 '2025-12-19', '2026-11-15', TRUE, '<p>PlayStation 5 Slim Digital Edition 1TB. 2 DualSense controllers included. Perfect condition.</p>',  FALSE, NULL),

('JBL Flip 6 Bluetooth Speaker', 1, 3, 2000000, 50000, 4000000, 2000000, NULL, 'images/products/p21_thumb.jpg',
 '2025-12-20', '2026-06-20', TRUE, '<p>JBL Flip 6 Portable Speaker Blue. IP67 waterproof. 12-hour playtime. PartyBoost compatible.</p>', TRUE, NULL),

('Philips Air Fryer XXL', 8, 2, 4000000, 100000, 7000000, 4000000, NULL, 'images/products/p22_thumb.jpg',
 '2025-12-21', '2026-07-25', TRUE, '<p>Philips Airfryer XXL HD9650. Rapid Air Technology. Fat Removal tech. Family size capacity.</p>',  TRUE, NULL),

('LG 55 inch 4K Smart TV', 7, 3, 10000000, 200000, 18000000, 10000000, NULL, 'images/products/p23_thumb.jpg',
 '2025-12-22', '2026-08-10', TRUE, '<p>LG 55UP7750 55 inch 4K UHD Smart TV. WebOS, ThinQ AI. Gaming Mode. Magic Remote included.</p>', FALSE, NULL),

('Seiko Presage Automatic', 6, 11, 8000000, 200000, 14000000, 8000000, NULL, 'images/products/p24_thumb.jpg',
 '2025-12-23', '2026-09-25', TRUE, '<p>Seiko Presage SRPD37J1 Cocktail Time. Automatic movement. Japanese craftsmanship. Full box papers.</p>', TRUE, NULL),

('Xiaomi Robot Vacuum S10', 7, 2, 6000000, 100000, 10000000, 6000000, NULL, 'images/products/p25_thumb.jpg',
 '2025-12-24', '2026-10-30', TRUE, '<p>Xiaomi Robot Vacuum S10. LDS laser navigation. Mopping function. App control with smart mapping.</p>',  TRUE, NULL),

-- ============================================
-- === ACTIVE BUT ENDING SOON (ID 26-34) ===
-- ============================================
-- Trạng thái: Active, No Bids, End in 1-2 days (Jan 7-8, 2026)
('Apple AirPods 3rd Gen', 1, 3, 3000000, 100000, 5000000, 3000000, NULL, 'images/products/p26_thumb.jpg',
 '2026-01-01', '2026-01-07 12:00:00', TRUE, '<p>Apple AirPods 3rd Generation. Spatial Audio. MagSafe charging case. Full box sealed.</p>',  FALSE, NULL),

('Logitech MX Master 3S Mouse', 1, 2, 1500000, 50000, 3000000, 1500000, NULL, 'images/products/p27_thumb.jpg',
 '2026-01-01', '2026-01-07 15:30:00', TRUE, '<p>Logitech MX Master 3S Wireless Mouse. Quiet clicks. 8K DPI sensor. USB-C fast charging.</p>', FALSE, NULL),

('Samsung 27 inch Monitor', 1, 3, 4000000, 100000, 7000000, 4000000, NULL, 'images/products/p28_thumb.jpg',
 '2026-01-01', '2026-01-08 09:00:00', TRUE, '<p>Samsung Odyssey G5 27 inch QHD 165Hz. Curved gaming monitor. 1ms response time.</p>', FALSE, NULL),

('Razer DeathAdder V3 Mouse', 1, 3, 1200000, 50000, 2500000, 1200000, NULL, 'images/products/p29_thumb.jpg',
 '2026-01-01', '2026-01-08 11:15:00', TRUE, '<p>Razer DeathAdder V3 Ergonomic Gaming Mouse. Ultra-lightweight.</p>',  FALSE, NULL),

('Converse Chuck Taylor All Star', 5, 2, 1000000, 50000, 2000000, 1000000, NULL, 'images/products/p30_thumb.jpg',
 '2026-01-01', '2026-01-07 20:00:00', TRUE, '<p>Converse Chuck Taylor All Star High Top Black. Size 42.</p>',  TRUE, NULL),

('Apple iPod Classic 160GB', 1, 2, 2000000, 100000, 5000000, 2000000, NULL, 'images/products/p31_thumb.jpg',
 '2026-01-01', '2026-01-08 14:00:00', FALSE, '<p>Apple iPod Classic 160GB. Vintage collector item. Working condition.</p>', TRUE, NULL),

('Delonghi Coffee Maker', 8, 2, 500000, 50000, 1500000, 500000, NULL, 'images/products/p32_thumb.jpg',
 '2026-01-01', '2026-01-07 08:30:00', FALSE, '<p>Delonghi Drip Coffee Maker. Used for 2 years. Still works perfectly.</p>',  TRUE, NULL),

('GoPro Hero 12 Black', 1, 11, 8000000, 200000, 14000000, 8000000, NULL, 'images/products/p33_thumb.jpg',
 '2026-01-01', '2026-01-08 18:00:00', FALSE, '<p>GoPro Hero 12 Black. 5.3K video. Waterproof.</p>', TRUE, NULL),

('Nintendo Switch OLED', 1, 2, 6000000, 100000, 10000000, 6000000, NULL, 'images/products/p34_thumb.jpg',
 '2026-01-01', '2026-01-07 22:45:00', FALSE, '<p>Nintendo Switch OLED White. Includes Mario Kart 8.</p>', TRUE, NULL),
('Ipad pro m4', 1, 3, 5000000, 500000, 24000000,5000000, NULL, 'images/products/p35_thumb.jpg', '2026-01-01', '2026-01-08 18:00:00', TRUE, '<p>iPad Pro 13-inch (M4 chip) 256GB Space Black. Ultra Retina XDR OLED display. The thinnest Apple product ever. Performance powerhouse for pros. Battery 100%, open box condition.</p>', TRUE, NULL);


-- ==========================================
-- 7. PRODUCT IMAGES (ALL PRODUCTS 1-35)
-- ==========================================
INSERT INTO product_images (product_id, img_link) VALUES
-- Active Products (ID 1-25)
(1, 'images/products/p1_1.jpg'), (1, 'images/products/p1_2.jpg'), (1, 'images/products/p1_3.jpg'),
(2, 'images/products/p2_1.jpg'), (2, 'images/products/p2_2.jpg'), (2, 'images/products/p2_3.jpg'),
(3, 'images/products/p3_1.jpg'), (3, 'images/products/p3_2.jpg'), (3, 'images/products/p3_3.jpg'),
(4, 'images/products/p4_1.jpg'), (4, 'images/products/p4_2.jpg'), (4, 'images/products/p4_3.jpg'),
(5, 'images/products/p5_1.jpg'), (5, 'images/products/p5_2.jpg'), (5, 'images/products/p5_3.jpg'),
(6, 'images/products/p6_1.jpg'), (6, 'images/products/p6_2.jpg'), (6, 'images/products/p6_3.jpg'),
(7, 'images/products/p7_1.jpg'), (7, 'images/products/p7_2.jpg'), (7, 'images/products/p7_3.jpg'),
(8, 'images/products/p8_1.jpg'), (8, 'images/products/p8_2.jpg'), (8, 'images/products/p8_3.jpg'),
(9, 'images/products/p9_1.jpg'), (9, 'images/products/p9_2.jpg'), (9, 'images/products/p9_3.jpg'),
(10, 'images/products/p10_1.jpg'), (10, 'images/products/p10_2.jpg'), (10, 'images/products/p10_3.jpg'),
(11, 'images/products/p11_1.jpg'), (11, 'images/products/p11_2.jpg'), (11, 'images/products/p11_3.jpg'),
(12, 'images/products/p12_1.jpg'), (12, 'images/products/p12_2.jpg'), (12, 'images/products/p12_3.jpg'),
(13, 'images/products/p13_1.jpg'), (13, 'images/products/p13_2.jpg'), (13, 'images/products/p13_3.jpg'),
(14, 'images/products/p14_1.jpg'), (14, 'images/products/p14_2.jpg'), (14, 'images/products/p14_3.jpg'),
(15, 'images/products/p15_1.jpg'), (15, 'images/products/p15_2.jpg'), (15, 'images/products/p15_3.jpg'),
(16, 'images/products/p16_1.jpg'), (16, 'images/products/p16_2.jpg'), (16, 'images/products/p16_3.jpg'),
(17, 'images/products/p17_1.jpg'), (17, 'images/products/p17_2.jpg'), (17, 'images/products/p17_3.jpg'),
(18, 'images/products/p18_1.jpg'), (18, 'images/products/p18_2.jpg'), (18, 'images/products/p18_3.jpg'),
(19, 'images/products/p19_1.jpg'), (19, 'images/products/p19_2.jpg'), (19, 'images/products/p19_3.jpg'),
(20, 'images/products/p20_1.jpg'), (20, 'images/products/p20_2.jpg'), (20, 'images/products/p20_3.jpg'),
(21, 'images/products/p21_1.jpg'), (21, 'images/products/p21_2.jpg'), (21, 'images/products/p21_3.jpg'),
(22, 'images/products/p22_1.jpg'), (22, 'images/products/p22_2.jpg'), (22, 'images/products/p22_3.jpg'),
(23, 'images/products/p23_1.jpg'), (23, 'images/products/p23_2.jpg'), (23, 'images/products/p23_3.jpg'),
(24, 'images/products/p24_1.jpg'), (24, 'images/products/p24_2.jpg'), (24, 'images/products/p24_3.jpg'),
(25, 'images/products/p25_1.jpg'), (25, 'images/products/p25_2.jpg'), (25, 'images/products/p25_3.jpg'),

-- Sold Products (ID 26-28)
(26, 'images/products/p26_1.jpg'), (26, 'images/products/p26_2.jpg'), (26, 'images/products/p26_3.jpg'),
(27, 'images/products/p27_1.jpg'), (27, 'images/products/p27_2.jpg'), (27, 'images/products/p27_3.jpg'),
(28, 'images/products/p28_1.jpg'), (28, 'images/products/p28_2.jpg'), (28, 'images/products/p28_3.jpg'),

-- Cancelled Products (ID 29-30)
(29, 'images/products/p29_1.jpg'), (29, 'images/products/p29_2.jpg'), (29, 'images/products/p29_3.jpg'),
(30, 'images/products/p30_1.jpg'), (30, 'images/products/p30_2.jpg'), (30, 'images/products/p30_3.jpg'),

-- Expired Products (ID 31-32)
(31, 'images/products/p31_1.jpg'), (31, 'images/products/p31_2.jpg'), (31, 'images/products/p31_3.jpg'),
(32, 'images/products/p32_1.jpg'), (32, 'images/products/p32_2.jpg'), (32, 'images/products/p32_3.jpg'),

-- Pending Products (ID 33-35)
(33, 'images/products/p33_1.jpg'), (33, 'images/products/p33_2.jpg'), (33, 'images/products/p33_3.jpg'),
(34, 'images/products/p34_1.jpg'), (34, 'images/products/p34_2.jpg'), (34, 'images/products/p34_3.jpg'),
(35, 'images/products/p35_1.jpg'), (35, 'images/products/p35_2.jpg'), (35, 'images/products/p35_3.jpg');

-- ==========================================
-- 8. WATCHLISTS
-- ==========================================
INSERT INTO watchlists (user_id, product_id, created_at) VALUES 
(4, 1, '2025-12-05'),
(4, 4, '2025-12-06'),
(4, 13, '2025-12-13'),
(4, 20, '2025-12-20'),
(5, 1, '2025-12-05'),
(5, 6, '2025-12-03'),
(5, 22, '2025-12-22'),
(10, 6, '2025-12-02'),
(10, 20, '2025-12-20'),
(10, 24, '2025-12-24'),
(7, 8, '2025-12-02'),
(7, 14, '2025-12-14'),
(7, 19, '2025-12-19'),
(9, 3, '2025-12-08'),
(9, 18, '2025-12-18'),
(12, 11, '2025-12-11'),
(8, 17, '2025-12-17'),
(8, 21, '2025-12-21');

-- ==========================================
-- 9. PRODUCT DESCRIPTION UPDATES
-- ==========================================
INSERT INTO product_description_updates (product_id, content, created_at) VALUES 
(1, '<b>Update:</b> Tìm thấy hóa đơn mua hàng gốc, sẽ gửi kèm.', '2025-12-06'),
(6, '<b>Bổ sung:</b> Tặng kèm túi đựng laptop chính hãng Apple.', '2025-12-03'),
(13, '<b>Lưu ý:</b> Có thêm ảnh chi tiết mặt trong túi.', '2025-12-14'),
(20, '<b>Update:</b> Đã service tại Rolex VN, có giấy tờ.', '2025-12-21');

-- ==========================================
-- 10. SYSTEM SETTINGS
-- ==========================================
INSERT INTO system_settings (id, new_product_limit_minutes, auto_extend_trigger_minutes, auto_extend_duration_minutes) 
VALUES (1, 60, 5, 10);

COMMIT;
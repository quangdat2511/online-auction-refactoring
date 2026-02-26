-- ============================================================
-- 1. TẠO FUNCTION remove_accents() (Loại bỏ dấu tiếng Việt)
-- ============================================================
CREATE OR REPLACE FUNCTION remove_accents(text) 
RETURNS text AS $$
BEGIN
    RETURN translate(
        lower($1),
        'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ',
        'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 2. THÊM CỘT fts (tsvector) VÀO BẢNG products
-- ============================================================
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS fts tsvector;

-- ============================================================
-- 3. TẠO INDEX GIN CHO FULL-TEXT SEARCH (Tăng tốc độ tìm kiếm)
-- ============================================================
CREATE INDEX IF NOT EXISTS products_fts_idx 
ON products USING GIN(fts);

-- ============================================================
-- 4. CẬP NHẬT DỮ LIỆU fts CHO CÁC PRODUCTS HIỆN CÓ
-- ============================================================
UPDATE products 
SET fts = to_tsvector('simple', remove_accents(name));

-- ============================================================
-- 5. TẠO TRIGGER TỰ ĐỘNG CẬP NHẬT fts KHI INSERT/UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION products_fts_update() 
RETURNS trigger AS $$
BEGIN
    NEW.fts := to_tsvector('simple', remove_accents(NEW.name));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tạo trigger
DROP TRIGGER IF EXISTS products_fts_trigger ON products;
CREATE TRIGGER products_fts_trigger 
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION products_fts_update();

-- ============================================================
-- 6. THÊM INDEX CHO categories.name ĐỂ TÌM KIẾM NHANH HƠN
-- ============================================================
CREATE INDEX IF NOT EXISTS categories_name_lower_idx 
ON categories(lower(remove_accents(name)));

-- ============================================================
-- ĐÃ HOÀN TẤT SETUP FULL-TEXT SEARCH!
-- Chạy query test bên dưới để kiểm tra:
-- ============================================================

-- Xem các products có fts column đã được populate chưa
-- SELECT id, name, fts FROM products LIMIT 5;

-- Đếm số lượng products có fts
-- SELECT COUNT(*) FROM products WHERE fts IS NOT NULL;

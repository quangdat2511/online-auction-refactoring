-- ============================================================
-- FUNCTION: mask_name_alternating
-- Mã hóa tên người dùng theo kiểu xen kẽ
-- Khoảng trắng cũng được coi như ký tự bình thường và có thể bị mã hóa
-- Ví dụ: "nndkhoa" -> "n*d*h*a"
--        "Nguyen Van A" -> "N*u*e* *a* *A" (khoảng trắng có thể bị mã hóa)
-- ============================================================

CREATE OR REPLACE FUNCTION mask_name_alternating(fullname TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    i INTEGER;
    len INTEGER;
BEGIN
    -- Trả về NULL nếu tên rỗng hoặc NULL (để view có thể hiển thị "No bids yet")
    IF fullname IS NULL OR trim(fullname) = '' THEN
        RETURN NULL;
    END IF;
    
    len := length(fullname);
    
    -- Xử lý các trường hợp đặc biệt
    IF len = 1 THEN
        RETURN '*';
    ELSIF len = 2 THEN
        RETURN substring(fullname, 1, 1) || '*';
    END IF;
    
    -- Mã hóa xen kẽ: giữ ký tự ở vị trí lẻ (1,3,5...), thay bằng * ở vị trí chẵn (2,4,6...)
    -- Khoảng trắng cũng được xử lý như ký tự bình thường
    FOR i IN 1..len LOOP
        IF i % 2 = 1 THEN
            -- Vị trí lẻ: giữ nguyên ký tự (kể cả khoảng trắng)
            result := result || substring(fullname, i, 1);
        ELSE
            -- Vị trí chẵn: thay bằng *
            result := result || '*';
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- TEST EXAMPLES:
-- SELECT mask_name_alternating('nndkhoa');        -- Output: n*d*h*a
-- SELECT mask_name_alternating('Nguyen Van A');   -- Output: N*u*e* *a* *A
-- SELECT mask_name_alternating('John Smith');     -- Output: J*h* *m*t*
-- SELECT mask_name_alternating('AB');             -- Output: A*
-- SELECT mask_name_alternating('A');              -- Output: *
-- SELECT mask_name_alternating('');               -- Output: NULL
-- SELECT mask_name_alternating(NULL);             -- Output: NULL
-- ============================================================

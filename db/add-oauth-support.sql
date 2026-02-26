-- Migration: Thêm hỗ trợ OAuth vào bảng users

-- Thêm cột oauth_provider và oauth_id vào bảng users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20),
ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255);

-- Tạo index cho việc tìm kiếm OAuth users
CREATE INDEX IF NOT EXISTS idx_oauth_provider_id 
ON users(oauth_provider, oauth_id);


-- Cập nhật constraint để đảm bảo OAuth users có provider và id
CREATE OR REPLACE FUNCTION check_oauth_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.oauth_provider IS NOT NULL AND NEW.oauth_id IS NULL THEN
        RAISE EXCEPTION 'oauth_id không được NULL khi oauth_provider có giá trị';
    END IF;
    
    IF NEW.oauth_provider IS NULL AND NEW.oauth_id IS NOT NULL THEN
        RAISE EXCEPTION 'oauth_provider không được NULL khi oauth_id có giá trị';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_oauth_fields_trigger ON users;
CREATE TRIGGER check_oauth_fields_trigger
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION check_oauth_fields();

-- Cập nhật unique constraint để cho phép multiple OAuth providers cho cùng 1 user
-- nhưng không cho phép duplicate OAuth provider+id
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_oauth
ON users(oauth_provider, oauth_id)
WHERE oauth_provider IS NOT NULL;

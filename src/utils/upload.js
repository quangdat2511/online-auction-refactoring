import multer from 'multer';
import path from 'path';
import { UPLOAD } from '../config/app.config.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

// General upload (no restrictions)
export const upload = multer({ storage });

// Image-only upload with 5MB limit (for payment/shipping proofs)
export const uploadImage = multer({
  storage,
  limits: { fileSize: UPLOAD.IMAGE_MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const ok =
      allowed.test(path.extname(file.originalname).toLowerCase()) &&
      allowed.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif)!'));
  },
});

import path from 'path';
import fs from 'fs';

// Di chuyển thumbnail và sub‑images, trả về đường dẫn đã lưu để cập nhật DB.
export async function moveProductImages(productId, thumbnail, imgsList) {
  const dirPath = path.join('public', 'images', 'products').replace(/\\/g, '/');
  const result = { thumbnailPath: null, imagePaths: [] };

  if (thumbnail) {
    const oldMainPath = path.join('public', 'uploads', path.basename(thumbnail)).replace(/\\/g, '/');
    const mainPath = path.join(dirPath, `p${productId}_thumb.jpg`).replace(/\\/g, '/');
    const savedMainPath = '/' + path.join('images', 'products', `p${productId}_thumb.jpg`).replace(/\\/g, '/');
    fs.renameSync(oldMainPath, mainPath);
    result.thumbnailPath = savedMainPath;
  }

  if (imgsList && imgsList.length) {
    let i = 1;
    for (const img of imgsList) {
      const oldPath = path.join('public', 'uploads', path.basename(img)).replace(/\\/g, '/');
      const newPath = path.join(dirPath, `p${productId}_${i}.jpg`).replace(/\\/g, '/');
      const savedPath = '/' + path.join('images', 'products', `p${productId}_${i}.jpg`).replace(/\\/g, '/');
      fs.renameSync(oldPath, newPath);
      result.imagePaths.push({ product_id: productId, img_link: savedPath });
      i++;
    }
  }

  return result;
}

import express from 'express';
import bcrypt from 'bcryptjs';
import * as userModel from '../../models/user.model.js';
import * as upgradeRequestModel from '../../models/upgradeRequest.model.js';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';

const router = express.Router();

// GET /profile - HIỂN THỊ PROFILE & THÔNG BÁO
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const user = await userModel.findById(currentUserId);

    // 1. Kiểm tra query string "success=true" trên URL
    let success_message = null;
    if (req.query.success === 'true') {
      success_message = 'Profile updated successfully.';
    }
    if (req.query['send-request-upgrade'] === 'true') {
      success_message = 'Your upgrade request has been sent successfully.';
    }
    // 2. Render và truyền biến success_message xuống view
    res.render('vwAccount/profile', {
      user: user,
      success_message: success_message // Nếu null thì HBS sẽ không hiện
    });

  } catch (err) {
    console.error(err);
    res.render('vwAccount/profile', {
      user: req.session.authUser,
      err_message: 'Unable to load profile information.'
    });
  }
});

// PUT /profile - XỬ LÝ UPDATE
router.put('/profile', isAuthenticated, async (req, res) => {
  try {
    // 1. Lấy dữ liệu từ form (Bổ sung address)
    const { email, fullname, address, date_of_birth, old_password, new_password, confirm_new_password } = req.body;
    const currentUserId = req.session.authUser.id;

    // Lấy thông tin user hiện tại
    const currentUser = await userModel.findById(currentUserId);

    // 2. KIỂM TRA MẬT KHẨU CŨ (Chỉ cho non-OAuth users)
    if (!currentUser.oauth_provider) {
      if (!old_password || !bcrypt.compareSync(old_password, currentUser.password_hash)) {
        return res.render('vwAccount/profile', {
          user: currentUser,
          err_message: 'Password is incorrect!'
        });
      }
    }

    // 3. KIỂM TRA TRÙNG EMAIL
    if (email !== currentUser.email) {
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return res.render('vwAccount/profile', {
          user: currentUser,
          err_message: 'Email is already in use by another user.'
        });
      }
    }

    // 4. KIỂM TRA MẬT KHẨU MỚI (Chỉ cho non-OAuth users)
    if (!currentUser.oauth_provider && new_password) {
      if (new_password !== confirm_new_password) {
        return res.render('vwAccount/profile', {
          user: currentUser,
          err_message: 'New passwords do not match.'
        });
      }
    }

    // 5. CHUẨN BỊ DỮ LIỆU UPDATE
    const entity = {
      email,
      fullname,
      address: address || currentUser.address,
      date_of_birth: date_of_birth ? new Date(date_of_birth) : currentUser.date_of_birth,
    };
    
    // Chỉ cập nhật password cho non-OAuth users
    if (!currentUser.oauth_provider) {
      entity.password_hash = new_password
        ? bcrypt.hashSync(new_password, 10)
        : currentUser.password_hash;
    }

    // 6. GỌI MODEL UPDATE (Model đã sửa để trả về Object)
    const updatedUser = await userModel.update(currentUserId, entity);
    console.log('Updated user result:', updatedUser);

    // 7. CẬP NHẬT SESSION
    if (updatedUser) {
      delete updatedUser.password_hash;
      req.session.authUser = updatedUser;
    }

    // 8. THÀNH CÔNG -> Redirect về trang profile kèm query success
    return res.redirect('/account/profile?success=true');

  } 
  catch (err) {
    console.error(err);
    return res.render('vwAccount/profile', {
      user: req.session.authUser,
      err_message: 'System error. Please try again later.'
    });
  }
});

router.get('/request-upgrade', isAuthenticated, async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const upgradeRequest = await upgradeRequestModel.findByUserId(currentUserId);
  res.render('vwAccount/request-upgrade', { upgrade_request: upgradeRequest });
});
router.post('/request-upgrade', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    await userModel.markUpgradePending(currentUserId);
    await upgradeRequestModel.createUpgradeRequest(currentUserId);
    return res.redirect('/account/profile?send-request-upgrade=true');
  } catch (err) {
    console.error(err);
    res.render('vwAccount/profile', {
      user: req.session.authUser,
      err_message: 'Unable to submit your request at this time. Please try again later.'
    });

  }
});

router.get('/seller/products', isAuthenticated, async (req, res) => {
  res.render('vwAccount/my-products');
});

router.get('/seller/sold-products', isAuthenticated, async (req, res) => {
  res.render('vwAccount/sold-products');
});

export default router;

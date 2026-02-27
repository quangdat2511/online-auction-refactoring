import express from 'express';
import bcrypt from 'bcryptjs';
import passport from '../../utils/passport.js';
import * as userModel from '../../models/user.model.js';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';
import { sendMail } from '../../utils/mailer.js';

const router = express.Router();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// GET /signup
router.get('/signup', function (req, res) {
  // CẬP NHẬT: Truyền Site Key xuống view để hiển thị widget
  res.render('vwAccount/auth/signup', {
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY
  });
});


// GET /signin
router.get('/signin', function (req, res) {
  const success_message = req.session.success_message;
  delete req.session.success_message;
  res.render('vwAccount/auth/signin', { success_message });
});

// GET /verify-email?email=...
router.get('/verify-email', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.redirect('/account/signin');
  }

  return res.render('vwAccount/auth/verify-otp', {
    email,
    info_message:
      'We have sent an OTP to your email. Please enter it below to verify your account.',
  });
});

router.get('/forgot-password', (req, res) => {
  res.render('vwAccount/auth/forgot-password');
});
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.render('vwAccount/auth/forgot-password', {
      error_message: 'Email not found.',
    });
  }
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
  await userModel.createOtp({
    user_id: user.id,
    otp_code: otp,
    purpose: 'reset_password',
    expires_at: expiresAt,
  });
  await sendMail({
    to: email,
    subject: 'Password Reset for Your Online Auction Account',
    html: `
      <p>Hi ${user.fullname},</p>
      <p>Your OTP code for password reset is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `,
  });
  return res.render('vwAccount/auth/verify-forgot-password-otp', {
    email,
  });
});
router.post('/verify-forgot-password-otp', async (req, res) => {
    const { email, otp } = req.body;
    const user = await userModel.findByEmail(email);
    const otpRecord = await userModel.findValidOtp({
      user_id: user.id,
      otp_code: otp,
      purpose: 'reset_password',
    });
    console.log('Verifying OTP for email:', email, ' OTP:', otp);
    if (!otpRecord) {
      console.log('Invalid OTP attempt for email:', email);
      return res.render('vwAccount/auth/verify-forgot-password-otp', {
        email,
        error_message: 'Invalid or expired OTP.',
      });
    }
    await userModel.markOtpUsed(otpRecord.id);
    return res.render('vwAccount/auth/reset-password', { email });
});
router.post('/resend-forgot-password-otp', async (req, res) => {
  const { email } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.render('vwAccount/auth/verify-forgot-password-otp', {
      email,
      error_message: 'User not found.',
    });
  }
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
  await userModel.createOtp({
    user_id: user.id,
    otp_code: otp,
    purpose: 'reset_password',
    expires_at: expiresAt,
  });
  await sendMail({
    to: email,
    subject: 'New OTP for Password Reset',
    html: `
      <p>Hi ${user.fullname},</p>
      <p>Your new OTP code for password reset is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `,
  });
  return res.render('vwAccount/auth/verify-forgot-password-otp', {
    email,
    info_message: 'We have sent a new OTP to your email. Please check your inbox.',
  });
});
router.post('/reset-password', async (req, res) => {
  const { email, new_password, confirm_new_password } = req.body;
  if (new_password !== confirm_new_password) {
    return res.render('vwAccount/auth/reset-password', {
      email,
      error_message: 'Passwords do not match.',
    });
  }
  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.render('vwAccount/auth/reset-password', {
      email,
      error_message: 'User not found.',
    });
  }
  const hashedPassword = bcrypt.hashSync(new_password, 10);
  await userModel.update(user.id, { password_hash: hashedPassword });
  return res.render('vwAccount/auth/signin', {
    success_message: 'Your password has been reset. You can sign in now.',
  });
});
// POST /signin
router.post('/signin', async function (req, res) {
  const { email, password } = req.body;

  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.render('vwAccount/auth/signin', {
      error_message: 'Invalid email or password',
      old: { email },
    });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    return res.render('vwAccount/auth/signin', {
      error_message: 'Invalid email or password',
      old: { email },
    });
  }

  // Chưa verify email -> gửi OTP và chuyển sang trang verify
  if (!user.email_verified) {
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    await userModel.createOtp({
      user_id: user.id,
      otp_code: otp,
      purpose: 'verify_email',
      expires_at: expiresAt,
    });

    await sendMail({
      to: email,
      subject: 'Verify your Online Auction account',
      html: `
        <p>Hi ${user.fullname},</p>
        <p>Your OTP code is: <strong>${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
      `,
    });

    return res.redirect(
      `/account/verify-email?email=${encodeURIComponent(email)}`
    );
  }

  // Đã verify -> login bình thường
  req.session.isAuthenticated = true;
  req.session.authUser = user;
  const returnUrl = req.session.returnUrl || '/';
  delete req.session.returnUrl;
  return res.redirect(returnUrl);
});

// POST /signup
router.post('/signup', async function (req, res) {
  const { fullname, email, address, password, confirmPassword } = req.body;
  
  // --- SỬA LỖI: Lấy token recaptcha từ body ---
  const recaptchaResponse = req.body['g-recaptcha-response'];
  
  const errors = {};
  const old = { fullname, email, address };
  const recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY;

  // // --- BẮT ĐẦU XỬ LÝ RECAPTCHA ---
  if (!recaptchaResponse) {
      errors.captcha = 'Please check the captcha box.';
  } else {
      // Gọi Google API để verify
      const secretKey = process.env.RECAPTCHA_SECRET;
      const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaResponse}`;
      
      try {
          const response = await fetch(verifyUrl, { method: 'POST' });
          const data = await response.json();
          // data.success trả về true nếu verify thành công
          if (!data.success) {
               errors.captcha = 'Captcha verification failed. Please try again.';
          }
      } catch (err) {
          console.error('Recaptcha error:', err);
          errors.captcha = 'Error connecting to captcha server.';
      }
  }
  // --- KẾT THÚC XỬ LÝ RECAPTCHA ---
  if (!fullname) errors.fullname = 'Full name is required';
  if (!address) errors.address = 'Address is required';
  if (!email) errors.email = 'Email is required';

  const isEmailExist = await userModel.findByEmail(email);
  if (isEmailExist) errors.email = 'Email is already in use';

  if (!password) errors.password = 'Password is required';
  if (password !== confirmPassword)
    errors.confirmPassword = 'Passwords do not match';

  if (Object.keys(errors).length > 0) {
    return res.render('vwAccount/auth/signup', {
      errors,
      old,
      error_message: 'Please correct the errors below.',
    });
  }

  const hashedPassword = bcrypt.hashSync(req.body.password, 10);
  console.log(hashedPassword);
  const user = {
    email: req.body.email,
    fullname: req.body.fullname,
    address: req.body.address,
    password_hash: hashedPassword,
    role: 'bidder',
  };

  const newUser = await userModel.add(user);

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

  console.log('User id: ', newUser.id, ' OTP: ', otp);

  await userModel.createOtp({
    user_id: newUser.id,
    otp_code: otp,
    purpose: 'verify_email',
    expires_at: expiresAt,
  });

  const verifyUrl = `${process.env.APP_BASE_URL}/account/verify-email?email=${encodeURIComponent(
    email
  )}`;

  await sendMail({
    to: email,
    subject: 'Verify your Online Auction account',
    html: `
        <p>Hi ${fullname},</p>
        <p>Thank you for registering at Online Auction.</p>
        <p>Your OTP code is: <strong>${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
        <p>You can enter this code on the verification page, or click the link below:</p>
        <p><a href="${verifyUrl}">Verify your email</a></p>
        <p>If you did not register, please ignore this email.</p>
        `,
  });

  // Chuyển sang trang verify email (GET /verify-email)
  return res.redirect(
    `/account/verify-email?email=${encodeURIComponent(email)}`
  );
});

// POST /verify-email
router.post('/verify-email', async (req, res) => {
  const { email, otp } = req.body;

  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.render('vwAccount/verify-otp', {
      email,
      error_message: 'User not found.',
    });
  }

  const otpRecord = await userModel.findValidOtp({
    user_id: user.id,
    otp_code: otp,
    purpose: 'verify_email',
  });

  if (!otpRecord) {
    return res.render('vwAccount/auth/verify-otp', {
      email,
      error_message: 'Invalid or expired OTP.',
    });
  }

  await userModel.markOtpUsed(otpRecord.id);
  await userModel.verifyUserEmail(user.id);

  req.session.success_message =
    'Your email has been verified. You can sign in now.';
  return res.redirect('/account/signin');
});

// POST /resend-otp
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;

  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.render('vwAccount/auth/verify-otp', {
      email,
      error_message: 'User not found.',
    });
  }

  if (user.email_verified) {
    return res.render('vwAccount/auth/signin', {
      success_message: 'Your email is already verified. Please sign in.',
    });
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

  await userModel.createOtp({
    user_id: user.id,
    otp_code: otp,
    purpose: 'verify_email',
    expires_at: expiresAt,
  });

  await sendMail({
    to: email,
    subject: 'New OTP for email verification',
    html: `
      <p>Hi ${user.fullname},</p>
      <p>Your new OTP code is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `,
  });

  return res.render('vwAccount/verify-otp', {
    email,
    info_message: 'We have sent a new OTP to your email. Please check your inbox.',
  });
});

router.post('/logout', isAuthenticated, (req, res) => {
  req.session.isAuthenticated = false;
  delete req.session.authUser;
  res.redirect('/');
});

// ===================== OAUTH ROUTES =====================

// Google OAuth
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/account/signin' }),
  (req, res) => {
    // Lưu user vào session
    req.session.authUser = req.user;
    req.session.isAuthenticated = true;
    res.redirect('/');
  }
);

// Facebook OAuth
// NOTE: 'email' scope chỉ hoạt động với Admin/Developer/Tester trong Development Mode
// Tạm thời chỉ dùng 'public_profile' để test, sau đó thêm 'email' khi đã add tester
router.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['public_profile'] })
);

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/account/signin' }),
  (req, res) => {
    req.session.authUser = req.user;
    req.session.isAuthenticated = true;
    res.redirect('/');
  }
);

// Twitter OAuth - DISABLED (Twitter API requires $100/month subscription)
// router.get('/auth/twitter',
//   passport.authenticate('twitter')
// );

// router.get('/auth/twitter/callback',
//   passport.authenticate('twitter', { failureRedirect: '/account/signin' }),
//   (req, res) => {
//     req.session.authUser = req.user;
//     req.session.isAuthenticated = true;
//     res.redirect('/');
//   }
// );

// GitHub OAuth
router.get('/auth/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

router.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/account/signin' }),
  (req, res) => {
    req.session.authUser = req.user;
    req.session.isAuthenticated = true;
    res.redirect('/');
  }
);

export default router;

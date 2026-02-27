import express from 'express';
import passport from '../../utils/passport.js';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';
import * as authService from '../../services/account/auth.service.js';

const router = express.Router();

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
  const result = await authService.initForgotPassword(email);
  if (!result.success) {
    return res.render('vwAccount/auth/forgot-password', {
      error_message: 'Email not found.',
    });
  }
  return res.render('vwAccount/auth/verify-forgot-password-otp', { email });
});
router.post('/verify-forgot-password-otp', async (req, res) => {
  const { email, otp } = req.body;
  const result = await authService.verifyForgotPasswordOtp(email, otp);
  if (!result.success) {
    return res.render('vwAccount/auth/verify-forgot-password-otp', {
      email,
      error_message: 'Invalid or expired OTP.',
    });
  }
  return res.render('vwAccount/auth/reset-password', { email });
});
router.post('/resend-forgot-password-otp', async (req, res) => {
  const { email } = req.body;
  const result = await authService.resendForgotPasswordOtp(email);
  if (!result.success) {
    return res.render('vwAccount/auth/verify-forgot-password-otp', {
      email,
      error_message: 'User not found.',
    });
  }
  return res.render('vwAccount/auth/verify-forgot-password-otp', {
    email,
    info_message: 'We have sent a new OTP to your email. Please check your inbox.',
  });
});
router.post('/reset-password', async (req, res) => {
  const { email, new_password, confirm_new_password } = req.body;
  const result = await authService.resetPassword(email, new_password, confirm_new_password);
  if (!result.success) {
    const errorMessages = {
      password_mismatch: 'Passwords do not match.',
      user_not_found: 'User not found.',
    };
    return res.render('vwAccount/auth/reset-password', {
      email,
      error_message: errorMessages[result.reason] || 'Something went wrong.',
    });
  }
  return res.render('vwAccount/auth/signin', {
    success_message: 'Your password has been reset. You can sign in now.',
  });
});
// POST /signin
router.post('/signin', async function (req, res) {
  const { email, password } = req.body;
  const result = await authService.authenticate(email, password);

  if (!result.success) {
    if (result.reason === 'unverified_email') {
      return res.redirect(`/account/verify-email?email=${encodeURIComponent(result.email)}`);
    }
    return res.render('vwAccount/auth/signin', {
      error_message: 'Invalid email or password',
      old: { email },
    });
  }

  req.session.isAuthenticated = true;
  req.session.authUser = result.user;
  const returnUrl = req.session.returnUrl || '/';
  delete req.session.returnUrl;
  return res.redirect(returnUrl);
});

// POST /signup
router.post('/signup', async function (req, res) {
  const { fullname, email, address, password, confirmPassword } = req.body;
  const recaptchaResponse = req.body['g-recaptcha-response'];

  const errors = {};
  const old = { fullname, email, address };
  const recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY;

  // Xác thực reCAPTCHA
  if (!recaptchaResponse) {
    errors.captcha = 'Please check the captcha box.';
  } else {
    const captchaResult = await authService.verifyRecaptcha(recaptchaResponse);
    if (captchaResult === null) {
      errors.captcha = 'Error connecting to captcha server.';
    } else if (!captchaResult) {
      errors.captcha = 'Captcha verification failed. Please try again.';
    }
  }

  if (!fullname) errors.fullname = 'Full name is required';
  if (!address) errors.address = 'Address is required';
  if (!email) errors.email = 'Email is required';

  if (email && !errors.email) {
    const emailTaken = await authService.isEmailTaken(email);
    if (emailTaken) errors.email = 'Email is already in use';
  }

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

  await authService.register({ fullname, email, address, password });
  return res.redirect(`/account/verify-email?email=${encodeURIComponent(email)}`);
});

// POST /verify-email
router.post('/verify-email', async (req, res) => {
  const { email, otp } = req.body;
  const result = await authService.verifyEmailOtp(email, otp);

  if (!result.success) {
    return res.render('vwAccount/auth/verify-otp', {
      email,
      error_message: result.reason === 'user_not_found' ? 'User not found.' : 'Invalid or expired OTP.',
    });
  }

  req.session.success_message = 'Your email has been verified. You can sign in now.';
  return res.redirect('/account/signin');
});

// POST /resend-otp
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  const result = await authService.resendEmailOtp(email);

  if (!result.success) {
    if (result.reason === 'already_verified') {
      return res.render('vwAccount/auth/signin', {
        success_message: 'Your email is already verified. Please sign in.',
      });
    }
    return res.render('vwAccount/auth/verify-otp', {
      email,
      error_message: 'User not found.',
    });
  }

  return res.render('vwAccount/auth/verify-otp', {
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

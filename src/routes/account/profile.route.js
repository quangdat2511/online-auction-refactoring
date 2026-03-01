import express from 'express';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';
import * as profileService from '../../services/account/profile.service.js';

const router = express.Router();

// GET /profile
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const user = await profileService.getProfileById(currentUserId);

    let success_message = null;
    if (req.query.success === 'true') {
      success_message = 'Profile updated successfully.';
    }
    if (req.query['send-request-upgrade'] === 'true') {
      success_message = 'Your upgrade request has been sent successfully.';
    }
    res.render('vwAccount/profile', {
      user: user,
      success_message: success_message
    });

  } catch (err) {
    console.error(err);
    res.render('vwAccount/profile', {
      user: req.session.authUser,
      err_message: 'Unable to load profile information.'
    });
  }
});

// PUT /profile
router.put('/profile', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const result = await profileService.updateProfile(currentUserId, req.body);

    if (!result.success) {
      const errorMessages = {
        wrong_password: 'Password is incorrect!',
        email_in_use: 'Email is already in use by another user.',
        password_mismatch: 'New passwords do not match.',
      };
      return res.render('vwAccount/profile', {
        user: result.user,
        err_message: errorMessages[result.reason] || 'Something went wrong.'
      });
    }

    if (result.updatedUser) {
      delete result.updatedUser.password_hash;
      req.session.authUser = result.updatedUser;
    }

    return res.redirect('/account/profile?success=true');

  } catch (err) {
    console.error(err);
    return res.render('vwAccount/profile', {
      user: req.session.authUser,
      err_message: 'System error. Please try again later.'
    });
  }
});

router.get('/request-upgrade', isAuthenticated, async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const upgradeRequest = await profileService.getUpgradeRequest(currentUserId);
  res.render('vwAccount/request-upgrade', { upgrade_request: upgradeRequest });
});

router.post('/request-upgrade', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    await profileService.submitUpgradeRequest(currentUserId);
    return res.redirect('/account/profile?send-request-upgrade=true');
  } catch (err) {
    console.error(err);
    res.render('vwAccount/profile', {
      user: req.session.authUser,
      err_message: 'Unable to submit your request at this time. Please try again later.'
    });
  }
});

// Seller shortcut views
router.get('/seller/products', isAuthenticated, async (req, res) => {
  res.render('vwAccount/my-products');
});

router.get('/seller/sold-products', isAuthenticated, async (req, res) => {
  res.render('vwAccount/sold-products');
});

export default router;

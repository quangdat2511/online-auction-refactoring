import express from 'express';
import * as profileService from '../../services/account/profile.service.js';

const router = express.Router();

// GET /profile
router.get('/profile', async (req, res) => {
  try {
    const user = await profileService.getProfileById(req.session.authUser.id);
    const success_message = req.query.success ? 'Profile updated successfully.' : null;
    res.render('vwAdmin/account/profile', { user, success_message });
  } catch (err) {
    console.error(err);
    res.render('vwAdmin/account/profile', { error_message: 'Unable to load profile information.' });
  }
});

// PUT /profile
router.put('/profile', async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const result = await profileService.updateProfile(currentUserId, req.body);

    if (!result.success) {
      const errorMessages = {
        wrong_password: 'Password is incorrect!',
        email_in_use: 'Email is already in use by another user.',
        password_mismatch: 'New passwords do not match.',
      };
      return res.render('vwAdmin/account/profile', {
        user: result.user,
        error_message: errorMessages[result.reason] || 'Something went wrong.'
      });
    }

    if (result.updatedUser) {
      delete result.updatedUser.password_hash;
      req.session.authUser = result.updatedUser;
    }

    return res.redirect('/admin/account/profile?success=true');
  } catch (err) {
    console.error(err);
    return res.render('vwAdmin/account/profile', {
      user: req.session.authUser,
      error_message: 'System error. Please try again later.'
    });
  }
});

export default router;
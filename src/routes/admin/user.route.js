import express from 'express';
import * as userService from '../../services/admin/user.service.js';

const router = express.Router();

router.get('/list', async (req, res) => {
  const users = await userService.listUsers();
  const success_message = req.session.success_message;
  const error_message = req.session.error_message;
  delete req.session.success_message;
  delete req.session.error_message;
  res.render('vwAdmin/users/list', {
    users,
    empty: users.length === 0,
    success_message,
    error_message,
  });
});

router.get('/detail/:id', async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  res.render('vwAdmin/users/detail', { user });
});

router.get('/add', (req, res) => {
  res.render('vwAdmin/users/add');
});

router.post('/add', async (req, res) => {
  try {
    await userService.addUser(req.body);
    req.session.success_message = 'User added successfully!';
    res.redirect('/admin/users/list');
  } catch (error) {
    console.error('Add user error:', error);
    req.session.error_message = 'Failed to add user. Please try again.';
    res.redirect('/admin/users/add');
  }
});

router.get('/edit/:id', async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  const error_message = req.session.error_message;
  delete req.session.error_message;
  res.render('vwAdmin/users/edit', { user, error_message });
});

router.post('/edit', async (req, res) => {
  try {
    const { id, ...rest } = req.body;
    await userService.updateUser(id, rest);
    req.session.success_message = 'User updated successfully!';
    res.redirect('/admin/users/list');
  } catch (error) {
    console.error('Update user error:', error);
    req.session.error_message = 'Failed to update user. Please try again.';
    res.redirect(`/admin/users/edit/${req.body.id}`);
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const user = await userService.resetPassword(req.body.id);
    req.session.success_message = `Password of ${user.fullname} reset successfully to default: 123`;
    res.redirect('/admin/users/list');
  } catch (error) {
    console.error('Reset password error:', error);
    req.session.error_message = 'Failed to reset password. Please try again.';
    res.redirect('/admin/users/list');
  }
});

router.post('/delete', async (req, res) => {
  try {
    await userService.deleteUser(req.body.id);
    req.session.success_message = 'User deleted successfully!';
    res.redirect('/admin/users/list');
  } catch (error) {
    console.error('Delete user error:', error);
    req.session.error_message = 'Failed to delete user. Please try again.';
    res.redirect('/admin/users/list');
  }
});

router.get('/upgrade-requests', async (req, res) => {
  const requests = await userService.listUpgradeRequests();
  res.render('vwAdmin/users/upgradeRequests', { requests });
});

router.post('/upgrade/approve', async (req, res) => {
  await userService.approveUpgrade(req.body.id, req.body.bidder_id);
  res.redirect('/admin/users/upgrade-requests');
});

router.post('/upgrade/reject', async (req, res) => {
  await userService.rejectUpgrade(req.body.id, req.body.admin_note);
  res.redirect('/admin/users/upgrade-requests');
});

export default router;

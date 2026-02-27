import express from 'express';
import * as systemService from '../../services/admin/system.service.js';

const router = express.Router();

router.get('/settings', async (req, res) => {
  try {
    const settings = await systemService.getSettings();
    res.render('vwAdmin/system/setting', {
      settings,
      success_message: req.query.success,
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.render('vwAdmin/system/setting', {
      settings: { new_product_limit_minutes: 60, auto_extend_trigger_minutes: 5, auto_extend_duration_minutes: 10 },
      error_message: 'Failed to load system settings',
    });
  }
});

router.post('/settings', async (req, res) => {
  try {
    await systemService.updateSettings(req.body);
    res.redirect('/admin/system/settings?success=Settings updated successfully');
  } catch (error) {
    console.error('Error updating settings:', error);
    const settings = await systemService.getSettings();
    res.render('vwAdmin/system/setting', {
      settings,
      error_message: 'Failed to update settings. Please try again.',
    });
  }
});

export default router;

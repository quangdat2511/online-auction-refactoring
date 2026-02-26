import express from 'express';
const router = express.Router();

// Define your admin category routes here
router.get('/profile', (req, res) => {
    res.render('vwAdmin/account/profile');
});

export default router;
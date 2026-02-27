import express from 'express';
import { getCategoriesWithLevel } from '../services/category.service.js';

const router = express.Router();

router.get('/categories', async (req, res) => {
  try {
    const categories = await getCategoriesWithLevel();
    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

export default router;

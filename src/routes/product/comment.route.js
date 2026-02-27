import express from 'express';
import * as commentService from '../../services/product/comment.service.js';
import { isAuthenticated } from '../../middlewares/auth.mdw.js';

const router = express.Router();

// ROUTE: POST COMMENT
router.post('/comment', isAuthenticated, async (req, res) => {
  const { productId, content, parentId } = req.body;
  const userId = req.session.authUser.id;

  try {
    await commentService.postComment({
      productId,
      userId,
      content,
      parentId,
      protocol: req.protocol,
      host: req.get('host'),
    });
    req.session.success_message = 'Comment posted successfully!';
  } catch (error) {
    console.error('Post comment error:', error);
    req.session.error_message = error.message || 'Failed to post comment. Please try again.';
  }

  res.redirect(`/products/detail?id=${productId}`);
});

export default router;

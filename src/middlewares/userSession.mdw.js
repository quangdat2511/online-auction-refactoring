import * as userModel from '../models/user.model.js';

const SESSION_REFRESH_INTERVAL = 60_000; // 60 seconds

export async function userSessionMiddleware(req, res, next) {
  // Bỏ qua static assets — không cần hit DB cho CSS/JS/images
  if (req.path.startsWith('/static')) return next();

  if (typeof req.session.isAuthenticated === 'undefined') {
    req.session.isAuthenticated = false;
  }

  if (req.session.isAuthenticated && req.session.authUser) {
    const lastRefresh = req.session.userLastRefresh || 0;

    // Chỉ đồng bộ DB mỗi 60 giây, tránh hit DB trên mọi request
    if (Date.now() - lastRefresh > SESSION_REFRESH_INTERVAL) {
      const currentUser = await userModel.findById(req.session.authUser.id);

      if (!currentUser) {
        // User bị xóa → tự động đăng xuất
        req.session.isAuthenticated = false;
        req.session.authUser = null;
      } else {
        req.session.authUser = {
          id: currentUser.id,
          username: currentUser.username,
          fullname: currentUser.fullname,
          email: currentUser.email,
          role: currentUser.role,
          address: currentUser.address,
          date_of_birth: currentUser.date_of_birth,
          email_verified: currentUser.email_verified,
          oauth_provider: currentUser.oauth_provider,
          oauth_id: currentUser.oauth_id,
        };
        req.session.userLastRefresh = Date.now();
      }
    }
  }

  res.locals.isAuthenticated = req.session.isAuthenticated;
  res.locals.authUser = req.session.authUser;
  res.locals.isAdmin = req.session.authUser?.role === 'admin';
  res.locals.isSeller = req.session.authUser?.role === 'seller';
  next();
}

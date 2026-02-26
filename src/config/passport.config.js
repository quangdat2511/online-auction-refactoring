import passport from '../utils/passport.js';

export function configurePassport(app) {
  app.use(passport.initialize());
  app.use(passport.session());
}

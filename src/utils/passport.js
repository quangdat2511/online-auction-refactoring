import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { userModel } from '../models/index.js';

// Serialize user vào session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user từ session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Factory function: tạo OAuth callback cho mọi provider — tránh lặp lại 30 dòng × 3
async function handleOAuthLogin(provider, displayNameFallback, profile, done) {
  try {
    let user = await userModel.findByOAuthProvider(provider, profile.id);
    if (user) return done(null, user);

    const email = profile.emails?.[0]?.value ?? null;
    if (email) {
      user = await userModel.findByEmail(email);
      if (user) {
        await userModel.addOAuthProvider(user.id, provider, profile.id);
        return done(null, user);
      }
    }

    const newUser = await userModel.add({
      email: email ?? `${provider}_${profile.id}@oauth.local`,
      fullname: profile.displayName || profile.username || displayNameFallback,
      password_hash: null,
      address: '',
      role: 'bidder',
      email_verified: true,
      oauth_provider: provider,
      oauth_id: profile.id,
    });
    done(null, newUser);
  } catch (error) {
    done(error, null);
  }
}

// ===================== GOOGLE STRATEGY =====================
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3005/account/auth/google/callback'
},
(accessToken, refreshToken, profile, done) =>
  handleOAuthLogin('google', 'Google User', profile, done)
));

// ===================== FACEBOOK STRATEGY =====================
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3005/account/auth/facebook/callback',
  profileFields: ['id', 'displayName', 'name', 'emails'],
  enableProof: true
},
(accessToken, refreshToken, profile, done) =>
  handleOAuthLogin('facebook', 'Facebook User', profile, done)
));

// ===================== GITHUB STRATEGY =====================
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3005/account/auth/github/callback'
},
(accessToken, refreshToken, profile, done) =>
  handleOAuthLogin('github', 'GitHub User', profile, done)
));


export default passport;

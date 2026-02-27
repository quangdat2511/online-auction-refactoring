import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import { Strategy as GitHubStrategy } from 'passport-github2';
import * as userModel from '../models/user.model.js';

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

// ===================== GOOGLE STRATEGY =====================
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3005/account/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
  try {
    // Kiểm tra xem user đã tồn tại chưa
    let user = await userModel.findByOAuthProvider('google', profile.id);
    
    if (user) {
      // User đã tồn tại, đăng nhập
      return done(null, user);
    }
    
    // Kiểm tra email đã tồn tại chưa
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    if (email) {
      user = await userModel.findByEmail(email);
      if (user) {
        // Cập nhật OAuth provider cho user hiện có
        await userModel.addOAuthProvider(user.id, 'google', profile.id);
        return done(null, user);
      }
    }
    
    // Tạo user mới
    const newUser = await userModel.add({
      email: email,
      fullname: profile.displayName || 'Google User',
      password_hash: null, // OAuth users không cần password
      address: '', // OAuth users chưa có address
      role: 'bidder',
      email_verified: true, // OAuth users đã verify email
      oauth_provider: 'google',
      oauth_id: profile.id
    });
    
    done(null, newUser);
  } catch (error) {
    done(error, null);
  }
}));

// ===================== FACEBOOK STRATEGY =====================
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3005/account/auth/facebook/callback',
  profileFields: ['id', 'displayName', 'name', 'emails'],
  enableProof: true
},
async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await userModel.findByOAuthProvider('facebook', profile.id);
    
    if (user) {
      return done(null, user);
    }
    
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    if (email) {
      user = await userModel.findByEmail(email);
      if (user) {
        await userModel.addOAuthProvider(user.id, 'facebook', profile.id);
        return done(null, user);
      }
    }
    
    const newUser = await userModel.add({
      email: email || `facebook_${profile.id}@oauth.local`,
      fullname: profile.displayName || 'Facebook User',
      password_hash: null, // OAuth users không cần password 
      address: '',      
      role: 'bidder',    
      email_verified: true,
      oauth_provider: 'facebook',
      oauth_id: profile.id
    });
    done(null, newUser);
  } catch (error) {
    done(error, null);
  }
}));

// ===================== TWITTER STRATEGY =====================
// DISABLED: Twitter API requires paid subscription ($100/month) for OAuth
// Free tier does not support OAuth since February 2023
/*
passport.use(new TwitterStrategy({
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackURL: process.env.TWITTER_CALLBACK_URL || 'http://localhost:3005/account/auth/twitter/callback',
  includeEmail: true
},
async (token, tokenSecret, profile, done) => {
  try {
    let user = await userModel.findByOAuthProvider('twitter', profile.id);
    
    if (user) {
      return done(null, user);
    }
    
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    if (email) {
      user = await userModel.findByEmail(email);
      if (user) {
        await userModel.addOAuthProvider(user.id, 'twitter', profile.id);
        return done(null, user);
      }
    }
    
    const newUser = await userModel.add({
      email: email || `twitter_${profile.id}@oauth.local`,
      fullname: profile.displayName || profile.username || 'Twitter User',
      password_hash: null,      address: '',      role: 'bidder',
      email_verified: true,
      oauth_provider: 'twitter',
      oauth_id: profile.id
    });
    
    done(null, newUser);
  } catch (error) {
    done(error, null);
  }
}));
*/

// ===================== GITHUB STRATEGY =====================
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3005/account/auth/github/callback'
},
async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await userModel.findByOAuthProvider('github', profile.id);
    
    if (user) {
      return done(null, user);
    }
    
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    if (email) {
      user = await userModel.findByEmail(email);
      if (user) {
        await userModel.addOAuthProvider(user.id, 'github', profile.id);
        return done(null, user);
      }
    }
    
    const newUser = await userModel.add({
      email: email || `github_${profile.id}@oauth.local`,
      fullname: profile.displayName || profile.username || 'GitHub User',
      password_hash: null,      address: '',      role: 'bidder',
      email_verified: true,
      oauth_provider: 'github',
      oauth_id: profile.id
    });
    
    done(null, newUser);
  } catch (error) {
    done(error, null);
  }
}));

export default passport;

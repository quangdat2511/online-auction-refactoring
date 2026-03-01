import db from '../../utils/db.js';

export async function add(user) {
  // PostgreSQL
  const rows = await db('users')
    .insert(user)
    .returning(['id', 'email', 'fullname', 'address', 'role', 'email_verified']);
  return rows[0]; // object: { id, email, fullname, ... }
}

export function findById(id, trx = null) {
  return (trx || db)('users').where('id', id).first();
}

export function loadAllUsers() {
  return db('users').orderBy('id', 'desc');
}

export function findUsersByRole(role) {
  return db('users')
    .select('users.id', 'users.fullname', 'users.email', 'users.role')
    .where('users.role', role)
    .orderBy('users.fullname', 'asc');
}

export function findByUserName(username) {
  return db('users').where('username', username).first();
}

export async function update(id, user) {
  const rows = await db('users')
    .where('id', id)
    .update(user)
    .returning('*');

  return rows[0];
}

export function findByEmail(email) {
  return db('users').where('email', email).first();
}

// OTP

// Create OTP record
export function createOtp({ user_id, otp_code, purpose, expires_at }) {
  return db('user_otps').insert({
    user_id,
    otp_code,
    purpose,
    expires_at
  });
}

// Find valid unexpired OTP
export function findValidOtp({ user_id, otp_code, purpose }) {
  return db('user_otps')
    .where({
      user_id,
      otp_code,
      purpose,
      used: false
    })
    .andWhere('expires_at', '>', db.fn.now())
    .orderBy('id', 'desc')
    .first();
}

// Mark OTP as used
export function markOtpUsed(id) {
  return db('user_otps')
    .where('id', id)
    .update({ used: true });
}

// Verify user email
export function verifyUserEmail(user_id) {
  return db('users')
    .where('id', user_id)
    .update({ email_verified: true });
}

export function updateUserInfo(user_id, { email, fullname, address }) {
  return db('users')
    .where('id', user_id)
    .update({ email, fullname, address });
}
export function markUpgradePending(user_id) {
  return db('users')
    .where('id', user_id)
    .update({ is_upgrade_pending: true });
}
export function updateUserRoleToSeller(user_id) {
  return db('users')
    .where('id', user_id)
    .update({ role: 'seller', is_upgrade_pending: false });
}

// OAuth

// Find user by OAuth provider
export function findByOAuthProvider(provider, oauth_id) {
  return db('users')
    .where({
      oauth_provider: provider,
      oauth_id: oauth_id
    })
    .first();
}

// Link OAuth provider to existing user
export function addOAuthProvider(user_id, provider, oauth_id) {
  return db('users')
    .where('id', user_id)
    .update({
      oauth_provider: provider,
      oauth_id: oauth_id,
      email_verified: true
    });
}

export async function deleteUser(id) {
  return db('users')
    .where('id', id)
    .del();
}

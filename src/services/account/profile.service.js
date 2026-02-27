import bcrypt from 'bcryptjs';
import * as userModel from '../../models/user.model.js';
import * as upgradeRequestModel from '../../models/upgradeRequest.model.js';

export async function getProfileById(userId) {
  return userModel.findById(userId);
}

export async function updateProfile(userId, { email, fullname, address, date_of_birth, old_password, new_password, confirm_new_password }) {
  const currentUser = await userModel.findById(userId);

  // Kiểm tra password cũ (chỉ cho non-OAuth users)
  if (!currentUser.oauth_provider) {
    if (!old_password || !bcrypt.compareSync(old_password, currentUser.password_hash)) {
      return { success: false, reason: 'wrong_password', user: currentUser };
    }
  }

  // Kiểm tra trùng email
  if (email !== currentUser.email) {
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) return { success: false, reason: 'email_in_use', user: currentUser };
  }

  // Kiểm tra password mới khớp (chỉ cho non-OAuth users)
  if (!currentUser.oauth_provider && new_password) {
    if (new_password !== confirm_new_password) {
      return { success: false, reason: 'password_mismatch', user: currentUser };
    }
  }

  const entity = {
    email,
    fullname,
    address: address || currentUser.address,
    date_of_birth: date_of_birth ? new Date(date_of_birth) : currentUser.date_of_birth,
  };

  if (!currentUser.oauth_provider) {
    entity.password_hash = new_password
      ? bcrypt.hashSync(new_password, 10)
      : currentUser.password_hash;
  }

  const updatedUser = await userModel.update(userId, entity);
  return { success: true, updatedUser };
}

export async function getUpgradeRequest(userId) {
  return upgradeRequestModel.findByUserId(userId);
}

export async function submitUpgradeRequest(userId) {
  await userModel.markUpgradePending(userId);
  await upgradeRequestModel.createUpgradeRequest(userId);
}

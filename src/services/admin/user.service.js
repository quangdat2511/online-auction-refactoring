import bcrypt from 'bcryptjs';
import { userModel, upgradeRequestModel } from '../../models/index.js';
import { sendMail } from '../../utils/mailer.js';
import { AUTH } from '../../config/app.config.js';

const DEFAULT_PASSWORD = '123';

export async function listUsers() {
  return userModel.loadAllUsers();
}

export async function getUserById(id) {
  return userModel.findById(id);
}

export async function addUser({ fullname, email, address, date_of_birth, role, email_verified, password }) {
  const hashedPassword = await bcrypt.hash(password, AUTH.BCRYPT_SALT_ROUNDS);
  await userModel.add({
    fullname,
    email,
    address,
    date_of_birth: date_of_birth || null,
    role,
    email_verified: email_verified === 'true',
    password_hash: hashedPassword,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

export async function updateUser(id, { fullname, email, address, date_of_birth, role, email_verified }) {
  await userModel.update(id, {
    fullname,
    email,
    address,
    date_of_birth: date_of_birth || null,
    role,
    email_verified: email_verified === 'true',
    updated_at: new Date(),
  });
}

export async function resetPassword(id) {
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, AUTH.BCRYPT_SALT_ROUNDS);
  const user = await userModel.findById(id);
  await userModel.update(id, { password_hash: hashedPassword, updated_at: new Date() });

  if (user?.email) {
    try {
      await sendMail({
        to: user.email,
        subject: 'Your Password Has Been Reset - Online Auction',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Notification</h2>
            <p>Dear <strong>${user.fullname}</strong>,</p>
            <p>Your account password has been reset by an administrator.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Your new temporary password:</strong></p>
              <p style="font-size: 24px; color: #e74c3c; margin: 10px 0; font-weight: bold;">${DEFAULT_PASSWORD}</p>
            </div>
            <p style="color: #e74c3c;"><strong>Important:</strong> Please log in and change your password immediately for security purposes.</p>
            <p>If you did not request this password reset, please contact our support team immediately.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px;">This is an automated message from Online Auction. Please do not reply to this email.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
    }
  }

  return user;
}

export async function deleteUser(id) {
  await userModel.deleteUser(id);
}

export async function listUpgradeRequests() {
  return upgradeRequestModel.loadAllUpgradeRequests();
}

export async function approveUpgrade(requestId, bidderId) {
  await upgradeRequestModel.approveUpgradeRequest(requestId);
  await userModel.updateUserRoleToSeller(bidderId);
}

export async function rejectUpgrade(requestId, adminNote) {
  await upgradeRequestModel.rejectUpgradeRequest(requestId, adminNote);
}

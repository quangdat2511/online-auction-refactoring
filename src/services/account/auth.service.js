import bcrypt from 'bcryptjs';
import * as userModel from '../../models/user.model.js';
import { sendMail } from '../../utils/mailer.js';

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function isEmailTaken(email) {
  const user = await userModel.findByEmail(email);
  return !!user;
}

export async function verifyRecaptcha(token) {
  if (!token) return false;
  const secretKey = process.env.RECAPTCHA_SECRET;
  const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;
  try {
    const response = await fetch(verifyUrl, { method: 'POST' });
    const data = await response.json();
    return data.success;
  } catch (err) {
    return null; // null = connection error
  }
}

async function createAndSendOtp(userId, email, fullname, purpose, subject, html) {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
  await userModel.createOtp({ user_id: userId, otp_code: otp, purpose, expires_at: expiresAt });
  await sendMail({ to: email, subject, html: html(otp) });
  return otp;
}

export async function register({ fullname, email, address, password }) {
  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = await userModel.add({
    email,
    fullname,
    address,
    password_hash: hashedPassword,
    role: 'bidder',
  });

  const verifyUrl = `${process.env.APP_BASE_URL}/account/verify-email?email=${encodeURIComponent(email)}`;
  await createAndSendOtp(
    newUser.id, email, fullname, 'verify_email',
    'Verify your Online Auction account',
    (otp) => `
      <p>Hi ${fullname},</p>
      <p>Thank you for registering at Online Auction.</p>
      <p>Your OTP code is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
      <p>You can enter this code on the verification page, or click the link below:</p>
      <p><a href="${verifyUrl}">Verify your email</a></p>
      <p>If you did not register, please ignore this email.</p>
    `
  );

  return newUser;
}

export async function authenticate(email, password) {
  const user = await userModel.findByEmail(email);
  if (!user) return { success: false, reason: 'invalid_credentials' };

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) return { success: false, reason: 'invalid_credentials' };

  if (!user.email_verified) {
    await createAndSendOtp(
      user.id, email, user.fullname, 'verify_email',
      'Verify your Online Auction account',
      (otp) => `
        <p>Hi ${user.fullname},</p>
        <p>Your OTP code is: <strong>${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
      `
    );
    return { success: false, reason: 'unverified_email', email };
  }

  return { success: true, user };
}

export async function verifyEmailOtp(email, otp) {
  const user = await userModel.findByEmail(email);
  if (!user) return { success: false, reason: 'user_not_found' };

  const otpRecord = await userModel.findValidOtp({
    user_id: user.id,
    otp_code: otp,
    purpose: 'verify_email',
  });
  if (!otpRecord) return { success: false, reason: 'invalid_otp' };

  await userModel.markOtpUsed(otpRecord.id);
  await userModel.verifyUserEmail(user.id);
  return { success: true };
}

export async function resendEmailOtp(email) {
  const user = await userModel.findByEmail(email);
  if (!user) return { success: false, reason: 'user_not_found' };
  if (user.email_verified) return { success: false, reason: 'already_verified' };

  await createAndSendOtp(
    user.id, email, user.fullname, 'verify_email',
    'New OTP for email verification',
    (otp) => `
      <p>Hi ${user.fullname},</p>
      <p>Your new OTP code is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `
  );
  return { success: true };
}

export async function initForgotPassword(email) {
  const user = await userModel.findByEmail(email);
  if (!user) return { success: false, reason: 'user_not_found' };

  await createAndSendOtp(
    user.id, email, user.fullname, 'reset_password',
    'Password Reset for Your Online Auction Account',
    (otp) => `
      <p>Hi ${user.fullname},</p>
      <p>Your OTP code for password reset is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `
  );
  return { success: true };
}

export async function verifyForgotPasswordOtp(email, otp) {
  const user = await userModel.findByEmail(email);
  if (!user) return { success: false, reason: 'user_not_found' };

  const otpRecord = await userModel.findValidOtp({
    user_id: user.id,
    otp_code: otp,
    purpose: 'reset_password',
  });
  if (!otpRecord) return { success: false, reason: 'invalid_otp' };

  await userModel.markOtpUsed(otpRecord.id);
  return { success: true };
}

export async function resendForgotPasswordOtp(email) {
  const user = await userModel.findByEmail(email);
  if (!user) return { success: false, reason: 'user_not_found' };

  await createAndSendOtp(
    user.id, email, user.fullname, 'reset_password',
    'New OTP for Password Reset',
    (otp) => `
      <p>Hi ${user.fullname},</p>
      <p>Your new OTP code for password reset is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `
  );
  return { success: true };
}

export async function resetPassword(email, newPassword, confirmPassword) {
  if (newPassword !== confirmPassword) return { success: false, reason: 'password_mismatch' };

  const user = await userModel.findByEmail(email);
  if (!user) return { success: false, reason: 'user_not_found' };

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  await userModel.update(user.id, { password_hash: hashedPassword });
  return { success: true };
}

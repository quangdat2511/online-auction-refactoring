// utils/mailer.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

// Create transporter for Gmail + App Password
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false, // 587 = STARTTLS (an toàn + dễ dùng)
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // APP PASSWORD 16 ký tự
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Test transporter (optional)
transporter.verify(function (error, success) {
  if (error) {
    console.error('❌ SMTP ERROR:', error);
  } else {
    console.log('📧 SMTP Ready to send mail');
  }
});

// Export sendMail function
export async function sendMail({ to, subject, html }) {
  console.log('➡️ Sending mail to:', to);
  return transporter.sendMail({
    from: `"Online Auction" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  });
}

export { transporter };

// Simple email sender using nodemailer
import nodemailer from 'nodemailer';

export async function sendAdminEmail({ to, subject, text }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // or your preferred email service
    auth: {
      user: process.env.NOTIFY_EMAIL_USER,
      pass: process.env.NOTIFY_EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.NOTIFY_EMAIL_USER,
    to,
    subject,
    text
  });
}
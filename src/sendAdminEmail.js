// Simple email sender using nodemailer
import nodemailer from 'nodemailer';

export async function sendAdminEmail({ to, subject, text }) {
  try {
    // Check if email configuration is available
    if (!process.env.NOTIFY_EMAIL_USER || !process.env.NOTIFY_EMAIL_PASS) {
      console.log('⚠️  Email notification skipped: NOTIFY_EMAIL_USER or NOTIFY_EMAIL_PASS not configured');
      return;
    }

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
    
    console.log('✅ Email notification sent successfully');
  } catch (error) {
    // Log the error but don't throw it to prevent crashes
    console.error('⚠️  Failed to send email notification:', error.message);
    console.error('   Application will continue without email notification');
  }
}
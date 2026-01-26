// Test email configuration
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from Backend directory
const envPath = path.join(__dirname, '..', '.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

console.log('\n📧 Email Configuration Check:\n');
console.log('EMAIL_SERVICE:', process.env.EMAIL_SERVICE || 'NOT SET');
console.log('EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***SET*** (length: ' + process.env.EMAIL_PASS.length + ')' : 'NOT SET');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'NOT SET');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.log('\n❌ Email not configured properly in .env file');
  process.exit(1);
}

console.log('\n🔄 Testing email connection...\n');

// Remove spaces from app password
const emailPassword = process.env.EMAIL_PASS.replace(/\s+/g, '');
console.log('Password (cleaned):', emailPassword ? '***SET*** (length: ' + emailPassword.length + ')' : 'NOT SET');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: emailPassword
  }
});

// Test the connection
transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ Email connection failed:');
    console.log(error.message);
    process.exit(1);
  } else {
    console.log('✅ Email server is ready to send messages');
    
    // Send a test email
    console.log('\n📧 Sending test OTP email...\n');
    
    const testOTP = '123456';
    
    transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to yourself for testing
      subject: 'Test OTP - SD CRM',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 SD CRM Security Test</h1>
            </div>
            <div class="content">
              <h2>Test OTP Email</h2>
              <p>This is a test email to verify OTP functionality.</p>
              
              <div class="otp-box">
                <div class="otp-code">${testOTP}</div>
                <p style="margin: 10px 0 0 0; color: #666;">Test OTP Code</p>
              </div>

              <p><strong>✅ Email Configuration Working!</strong></p>
              <p>Your SD CRM application can now send OTP emails.</p>
            </div>
          </div>
        </body>
        </html>
      `
    }, (err, info) => {
      if (err) {
        console.log('❌ Failed to send test email:');
        console.log(err.message);
        process.exit(1);
      } else {
        console.log('✅ Test email sent successfully!');
        console.log('📬 Message ID:', info.messageId);
        console.log('📧 Check your inbox:', process.env.EMAIL_USER);
        process.exit(0);
      }
    });
  }
});

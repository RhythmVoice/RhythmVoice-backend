import nodemailer from 'nodemailer';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// 建立郵件傳送器
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const verifyEmailConfig = async () => {
  try {
    await transporter.verify();
    return {
      success: true,
      message: 'Email 配置驗證成功'
    };
  } catch (error) {
    console.error('Email 配置驗證失敗:', error);
    return {
      success: false,
      error: 'EMAIL_CONFIG_INVALID',
      message: 'Email 配置無效',
      details: error.message
    };
  }
};

const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return process.env.FRONTEND_URL;
};

const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const buildVerificationUrl = (token) => {
  const frontendUrl = getFrontendUrl();
  return `${frontendUrl}/api/auth/email/verify-email/${token}`;
};

const getVerificationEmailTemplate = (username, verificationUrl, token) => {
  return `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
      <div style="background: #007bff; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; color: white;">${process.env.APP_NAME || '應用程式'}</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">哈囉 ${username}！</h2>
          <p>感謝您註冊我們的服務！請點擊下方按鈕來驗證您的信箱：</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
              style="background-color: #007bff; color: white; padding: 12px 30px; 
              text-decoration: none; border-radius: 5px; display: inline-block;">
              驗證信箱
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            或複製以下連結到瀏覽器：<br>
            <span style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 4px; display: block; margin-top: 10px;">
              ${verificationUrl}
            </span>
          </p>
          
          <p><strong>注意：</strong></p>
          <ul>
              <li>此驗證連結將在 24 小時後過期</li>
              <li>如果您沒有註冊此帳號，請忽略此信件</li>
              <li>為了您的安全，請勿將此連結分享給他人</li>
          </ul>
      </div>
      <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 5px 0;">如有任何問題，請聯絡我們的客服團隊</p>
          <p style="margin: 5px 0;">此信件由系統自動發送，請勿直接回覆</p>
          <p style="margin: 5px 0;">驗證碼：${token}</p>
      </div>
    </div>
  `;
};

const sendVerificationEmail = async (email, verificationToken, username) => {
  try {
    const verificationUrl = buildVerificationUrl(verificationToken);
    
    const mailOptions = {
      from: {
        name: process.env.APP_NAME || '應用程式',
        address: process.env.EMAIL_FROM
      },
      to: email,
      subject: '帳號驗證 - 請完成信箱驗證',
      html: getVerificationEmailTemplate(username, verificationUrl, verificationToken)
    };

    console.log(`[EMAIL] 準備發送驗證信給 ${email}`);
    
    const result = await transporter.sendMail(mailOptions);
    
    console.log(`[EMAIL] 驗證信發送成功`, {
      messageId: result.messageId,
      email: email,
      username: username
    });

    return {
      success: true,
      messageId: result.messageId,
      message: '驗證信發送成功'
    };
  } catch (error) {
    console.error('[EMAIL] 發送驗證信失敗:', error);
    
    return {
      success: false,
      error: 'EMAIL_SEND_FAILED',
      message: '發送驗證信失敗，請稍後再試',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
};

const getWelcomeEmailTemplate = (username) => {
  return `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
      <div style="background: #28a745; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; color: white;">歡迎加入 ${process.env.APP_NAME || '我們的平台'}！</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">哈囉 ${username}！</h2>
          <p>恭喜您成功完成 email 驗證！您的帳號已經啟用，現在可以開始使用我們的所有功能。</p>
          
          <h3 style="color: #333;">接下來您可以：</h3>
          <ul>
              <li>完善您的個人資料</li>
              <li>探索我們的功能特色</li>
              <li>訂購演唱會的門票</li>
          </ul>
          
          <p>如果您有任何問題或需要協助，隨時歡迎聯絡我們的客服團隊。</p>
          
          <p>再次歡迎您的加入，祝您使用愉快！</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 5px 0;">感謝您選擇 ${process.env.APP_NAME || '我們的服務'}</p>
          <p style="margin: 5px 0;">此信件由系統自動發送，請勿直接回覆</p>
      </div>
    </div>
  `;
};

const sendWelcomeEmail = async (email, username) => {
  try {
    const mailOptions = {
      from: {
        name: process.env.APP_NAME || '應用程式',
        address: process.env.EMAIL_FROM
      },
      to: email,
      subject: `歡迎加入 ${process.env.APP_NAME || '我們的平台'}！`,
      html: getWelcomeEmailTemplate(username)
    };

    const result = await transporter.sendMail(mailOptions);
    
    console.log(`[EMAIL] 歡迎信發送成功`, {
      messageId: result.messageId,
      email: email,
      username: username
    });

    return {
      success: true,
      messageId: result.messageId,
      message: '歡迎信發送成功'
    };
  } catch (error) {
    console.error('[EMAIL] 發送歡迎信失敗:', error);
    
    return {
      success: false,
      error: 'WELCOME_EMAIL_FAILED',
      message: '發送歡迎信失敗',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
};

export {
  verifyEmailConfig,
  sendVerificationEmail,
  sendWelcomeEmail,
  generateVerificationToken,
  buildVerificationUrl,
  getVerificationEmailTemplate,
  getWelcomeEmailTemplate,
  getFrontendUrl
};
import bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { usersTable, emailUsersTable, userProfilesTable } from '../../models/schema.js';
import { loginUser } from '../../services/auth/authService.js';
import { sendVerificationEmail, sendWelcomeEmail, generateVerificationToken } from '../../services/auth/emailService.js'

import dotenv from 'dotenv';

dotenv.config();

// 註冊
const signup = async (req, res) => {
  console.log('[EMAIL_SIGNUP] 開始註冊流程:', { 
    username: req.body.username, 
    email: req.body.email,
    hasBirthday: !!req.body.birthday,
    hasPhone: !!req.body.phone,
    ip: req.ip 
  });

  try {
    const { username, email, password, birthday, phone } = req.body;

    console.log('[EMAIL_SIGNUP] 檢查 Email 是否已存在');
    // 檢查 email 是否已被註冊
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(and(
        eq(usersTable.email, email),
        eq(usersTable.providerType, 'email')
      ))
      .limit(1);

    if (existingUser) {
      console.error(`[EMAIL_SIGNUP] Email 已存在:`, { 
        email, 
        existingUserId: existingUser.id,
        existingUsername: existingUser.username 
      });
      
      return res.status(409).json({
        success: false,
        error: 'EMAIL_ALREADY_EXISTS',
        message: '此 Email 已經被註冊，請使用其他 Email 或嘗試登入',
        timestamp: new Date().toISOString()
      });
    }

    console.log('[EMAIL_SIGNUP] Email 可用，開始加密密碼');
    // 密碼加密
    const saltRounds = process.env.NODE_ENV === 'development' ? 10 : 12;
    console.log(`[EMAIL_SIGNUP] 使用 ${saltRounds} rounds 加密密碼`);
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 生成 email 驗證 token
    console.log('[EMAIL_SIGNUP] 生成 Email 驗證 token');
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    console.log('[EMAIL_SIGNUP] 驗證 token 生成完成，有效期 24 小時');

    console.log('[EMAIL_SIGNUP] 開始資料庫交易 - 創建用戶');
    // 創建會員資料
    const result = await db.transaction(async (tx) => {
      try {
        console.log('[EMAIL_SIGNUP] 插入主用戶表');
        const [newUser] = await tx
          .insert(usersTable)
          .values({
            username,
            email,
            role: 'user',
            providerType: 'email',
            status: 'active'
          })
          .returning({
            id: usersTable.id,
            username: usersTable.username,
            email: usersTable.email,
            role: usersTable.role,
            providerType: usersTable.providerType
          });

        console.log('[EMAIL_SIGNUP] 用戶創建成功:', { userId: newUser.id, username: newUser.username });

        console.log('[EMAIL_SIGNUP] 插入 Email 認證表');
        const [emailUser] = await tx
          .insert(emailUsersTable)
          .values({
            userId: newUser.id,
            password: hashedPassword,
            isVerifiedEmail: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: verificationExpires,
            lastVerificationEmailSent: new Date()
          })
          .returning();

        console.log('[EMAIL_SIGNUP] Email 認證資料創建成功');

        console.log('[EMAIL_SIGNUP] 插入用戶資料表');
        const profileData = {
          userId: newUser.id,
          birthday: birthday,
          phone: phone
        };

        const [userProfile] = await tx
          .insert(userProfilesTable)
          .values(profileData)
          .returning({
            birthday: userProfilesTable.birthday,
            phone: userProfilesTable.phone
          });

        console.log('[EMAIL_SIGNUP] 用戶資料創建成功');

        return {
          user: newUser,
          emailUser: emailUser,
          userProfile: userProfile
        };
      } catch (txError) {
        console.error('[EMAIL_SIGNUP] 交易失敗:', txError.message);
        throw txError;
      }
    });

    console.log('[EMAIL_SIGNUP] 註冊完成，準備發送驗證信:', { 
      userId: result.user.id, 
      username: result.user.username,
      email: result.user.email 
    });
    
    console.log('[EMAIL_SIGNUP] 發送驗證信');
    const emailResult = await sendVerificationEmail(email, verificationToken, username);
    
    if (emailResult.success) {
      console.log('[EMAIL_SIGNUP] 驗證信發送成功:', { messageId: emailResult.messageId });
    } else {
      console.error('[EMAIL_SIGNUP] 驗證信發送失敗:', emailResult.error);
    }

    return res.status(201).json({
      success: true,
      message: emailResult.success 
        ? '註冊成功！請檢查您的信箱並點擊驗證連結來啟用您的帳號'
        : '註冊成功！但驗證信發送失敗，請稍後重新發送驗證信',
      data: {
        userId: result.user.id,
        username: result.user.username,
        email: result.user.email,
        emailSent: emailResult.success,
        requiresEmailVerification: true,
        nextStep: emailResult.success 
          ? '請到信箱點擊驗證連結' 
          : '請重新發送驗證信',
        redirectUrl: '/login',
        loginMessage: '完成 Email 驗證後即可登入'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[EMAIL_SIGNUP] 註冊失敗:', error);

    // 檢查是否為資料庫約束錯誤
    if (error.code === '23505') { // PostgreSQL unique violation
      console.error('[EMAIL_SIGNUP] 唯一約束違反:', error.detail);
      if (error.detail?.includes('email')) {
        return res.status(409).json({
          success: false,
          error: 'EMAIL_ALREADY_EXISTS',
          message: '此 Email 已經被註冊',
          timestamp: new Date().toISOString()
        });
      }
    }

    // 一般伺服器錯誤
    return res.status(500).json({
      success: false,
      error: 'SIGNUP_FAILED',
      message: '註冊失敗，請稍後再試',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          message: error.message,
          code: error.code
        }
      })
    });
  }
}

// 登入
const login = async (req, res) => {
  console.log('[EMAIL_LOGIN] 開始登入流程:', { 
    email: req.body.email,
    hasPassword: !!req.body.password,
    rememberMe: req.body.rememberMe || false,
    ip: req.ip 
  });

  try {
    const { email, password } = req.body;

    console.log('[EMAIL_LOGIN] 查詢用戶資料');
    const [userQuery] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        role: usersTable.role,
        providerType: usersTable.providerType,
        status: usersTable.status,
        // Email 認證資料
        password: emailUsersTable.password,
        isVerifiedEmail: emailUsersTable.isVerifiedEmail
      })
      .from(usersTable)
      .leftJoin(emailUsersTable, eq(usersTable.id, emailUsersTable.userId))
      .where(and(
        eq(usersTable.email, email),
        eq(usersTable.providerType, 'email')
      ))
      .limit(1);

    if (!userQuery) {
      console.warn('[EMAIL_LOGIN] 用戶不存在:', { email });
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Email 或密碼錯誤',
        timestamp: new Date().toISOString()
      });
    }

    console.log('[EMAIL_LOGIN] 找到用戶，檢查帳號狀態:', { 
      userId: userQuery.id, 
      username: userQuery.username,
      status: userQuery.status,
      isVerifiedEmail: userQuery.isVerifiedEmail,
      hasPassword: !!userQuery.password 
    });

    // 驗證 Email
    if (!userQuery.isVerifiedEmail) {
      console.warn('[EMAIL_LOGIN] Email 未驗證:', { 
        userId: userQuery.id, 
        email: userQuery.email 
      });
      return res.status(403).json({
        success: false,
        error: 'EMAIL_NOT_VERIFIED',
        message: '請先完成 Email 驗證才能登入',
        data: {
          requiresEmailVerification: true,
          email: userQuery.email,
          userId: userQuery.id,
          resendVerificationUrl: '/api/auth/email/verify-email/resend'
        },
        timestamp: new Date().toISOString()
      });
    }

    console.log('[EMAIL_LOGIN] 驗證密碼');
    const isMatch = await bcrypt.compare(password, userQuery.password);
    
    if (!isMatch) {
      console.warn('[EMAIL_LOGIN] 密碼驗證失敗:', { 
        userId: userQuery.id, 
        username: userQuery.username 
      });
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Email 或密碼錯誤',
        timestamp: new Date().toISOString()
      });
    }

    console.log('[EMAIL_LOGIN] 密碼驗證成功，準備登入資料');
    const loginData = {
      id: userQuery.id,
      username: userQuery.username,
      email: userQuery.email,
      role: userQuery.role,
      providerType: userQuery.providerType,
    };

    console.log('[EMAIL_LOGIN] 調用統一登入服務');
    const loginResult = await loginUser(res, loginData, {
      rememberMe: req.body.rememberMe || false,
      redirectUrl: '/dashboard'
    });

    if (!loginResult.success) {
      console.error('[EMAIL_LOGIN] 統一登入服務失敗:', loginResult.error);
      return res.status(500).json({
        success: false,
        error: 'LOGIN_SERVICE_FAILED',
        message: '登入處理失敗，請重試',
        timestamp: new Date().toISOString()
      });
    }

    console.log('[EMAIL_LOGIN] 登入成功:', { 
      userId: userQuery.id, 
      username: userQuery.username,
      email: userQuery.email 
    });

    return res.json({
      success: true,
      message: '登入成功！歡迎回來',
      data: {
        user: {
          id: userQuery.id,
          username: userQuery.username,
          email: userQuery.email,
          role: userQuery.role,
          providerType: userQuery.providerType,
          isEmailVerified: true,
        },
        redirectUrl: loginResult.redirectUrl,
        csrfToken: loginResult.csrfToken
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[EMAIL_LOGIN] 登入失敗:', error);

    return res.status(500).json({
      success: false,
      error: 'LOGIN_FAILED',
      message: '登入失敗，請稍後再試',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          message: error.message
        }
      })
    });
  }
};

// 驗證 Email
const verifyEmail = async (req, res) => {
  console.log('[VERIFY_EMAIL] 開始 Email 驗證:', { 
    tokenPrefix: req.params.token?.substring(0, 10) + '...',
    ip: req.ip 
  });

  try {
    const { token } = req.params;

    if (!token) {
      console.error('[VERIFY_EMAIL] 缺少驗證 token');
      return res.status(400).json({
        success: false,
        error: 'MISSING_TOKEN',
        message: '缺少驗證 token',
        timestamp: new Date().toISOString()
      });
    }

    console.log('[VERIFY_EMAIL] 查詢驗證 token');
    // 查詢驗證 token
    const [emailUserQuery] = await db
      .select({
        userId: emailUsersTable.userId,
        isVerifiedEmail: emailUsersTable.isVerifiedEmail,
        emailVerificationExpires: emailUsersTable.emailVerificationExpires,
        username: usersTable.username,
        email: usersTable.email
      })
      .from(emailUsersTable)
      .leftJoin(usersTable, eq(emailUsersTable.userId, usersTable.id))
      .where(eq(emailUsersTable.emailVerificationToken, token))
      .limit(1);

    if (!emailUserQuery) {
      console.warn(`[VERIFY_EMAIL] 無效的驗證 token:`, { tokenPrefix: token.substring(0, 10) + '...' });
      
      return res.status(400).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: '無效的驗證連結',
        timestamp: new Date().toISOString()
      });
    }

    console.log('[VERIFY_EMAIL] 找到用戶，檢查驗證狀態:', {
      userId: emailUserQuery.userId,
      username: emailUserQuery.username,
      email: emailUserQuery.email,
      isVerifiedEmail: emailUserQuery.isVerifiedEmail
    });

    // 檢查是否已經驗證
    if (emailUserQuery.isVerifiedEmail) {
      console.log('[VERIFY_EMAIL] Email 已經驗證過:', { userId: emailUserQuery.userId });
      
      return res.json({
        success: true,
        message: '您的 Email 已經完成驗證',
        data: {
          alreadyVerified: true,
          userId: emailUserQuery.userId
        },
        timestamp: new Date().toISOString()
      });
    }

    // 檢查 token 是否過期
    const now = new Date();
    if (emailUserQuery.emailVerificationExpires < now) {
      console.warn('[VERIFY_EMAIL] 驗證 token 已過期:', { 
        userId: emailUserQuery.userId,
        expiredAt: emailUserQuery.emailVerificationExpires,
        now: now
      });
      
      return res.status(400).json({
        success: false,
        error: 'TOKEN_EXPIRED',
        message: '驗證連結已過期，請重新申請驗證信',
        data: {
          expired: true,
          userId: emailUserQuery.userId
        },
        timestamp: new Date().toISOString()
      });
    }

    console.log('[VERIFY_EMAIL] 更新驗證狀態');
    await db
      .update(emailUsersTable)
      .set({
        isVerifiedEmail: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        updatedAt: now
      })
      .where(eq(emailUsersTable.userId, emailUserQuery.userId));

    console.log('[VERIFY_EMAIL] Email 驗證成功:', { 
      userId: emailUserQuery.userId,
      email: emailUserQuery.email 
    });

    // 發送歡迎信
    console.log('[VERIFY_EMAIL] 發送歡迎信');
    try {
      const welcomeResult = await sendWelcomeEmail(emailUserQuery.email, emailUserQuery.username);
      if (welcomeResult.success) {
        console.log('[VERIFY_EMAIL] 歡迎信發送成功');
      } else {
        console.warn('[VERIFY_EMAIL] 歡迎信發送失敗:', welcomeResult.error);
      }
    } catch (welcomeError) {
      console.error('[VERIFY_EMAIL] 歡迎信發送錯誤:', welcomeError.message);
    }

    return res.json({
      success: true,
      message: 'Email 驗證成功！歡迎加入我們！',
      data: {
        userId: emailUserQuery.userId,
        email: emailUserQuery.email,
        username: emailUserQuery.username,
        verified: true,
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[VERIFY_EMAIL] Email 驗證失敗:', error);

    return res.status(500).json({
      success: false,
      error: 'VERIFY_EMAIL_FAILED',
      message: 'Email 驗證失敗',
      timestamp: new Date().toISOString()
    });
  }
};

// 重新發送驗證信
const resendVerificationEmail = async (req, res) => {
  console.log('[RESEND_VERIFICATION] 開始重新發送驗證信:', { 
    email: req.body.email,
    ip: req.ip 
  });

  try {
    const { email } = req.body;

    if (!email) {
      console.error('[RESEND_VERIFICATION] 缺少 Email 參數');
      return res.status(400).json({ 
        success: false,
        error: 'MISSING_EMAIL',
        message: '請提供信箱地址',
        timestamp: new Date().toISOString()
      });
    }

    console.log('[RESEND_VERIFICATION] 查詢用戶資料');
    const [emailUserQuery] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        isVerifiedEmail: emailUsersTable.isVerifiedEmail,
        lastVerificationEmailSent: emailUsersTable.lastVerificationEmailSent,
        emailVerificationToken: emailUsersTable.emailVerificationToken,
        emailVerificationExpires: emailUsersTable.emailVerificationExpires
      })
      .from(usersTable)
      .leftJoin(emailUsersTable, eq(usersTable.id, emailUsersTable.userId))
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!emailUserQuery) {
      console.warn('[RESEND_VERIFICATION] 用戶不存在:', { email });
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: '找不到用戶資料',
        timestamp: new Date().toISOString()
      });
    }

    console.log('[RESEND_VERIFICATION] 找到用戶，檢查驗證狀態:', {
      userId: emailUserQuery.id,
      username: emailUserQuery.username,
      isVerifiedEmail: emailUserQuery.isVerifiedEmail
    });

    if (emailUserQuery.isVerifiedEmail) {
      console.log('[RESEND_VERIFICATION] Email 已經驗證過:', { userId: emailUserQuery.id });
      return res.json({
        success: true,
        message: '您的 Email 已經完成驗證',
        data: {
          alreadyVerified: true
        },
        timestamp: new Date().toISOString()
      });
    }

    // 檢查發送冷卻時間
    console.log('[RESEND_VERIFICATION] 檢查發送冷卻時間');
    const now = new Date();
    const lastSent = emailUserQuery.lastVerificationEmailSent;
    const cooldownMs = 5 * 60 * 1000; // 5 分鐘

    if (lastSent) {
      const timePassed = now.getTime() - lastSent.getTime();
      
      if (timePassed < cooldownMs) {
        const waitTime = Math.ceil((cooldownMs - timePassed) / 60000);
        
        console.warn('[RESEND_VERIFICATION] 發送過於頻繁:', { 
          userId: emailUserQuery.id,
          lastSent: lastSent,
          waitTime: waitTime 
        });
        
        return res.status(429).json({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: `請等待 ${waitTime} 分鐘後再重新發送驗證信`,
          data: {
            waitTime: waitTime,
            cooldownMs: cooldownMs
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    // 生成新的驗證 token
    console.log('[RESEND_VERIFICATION] 生成新的驗證 token');
    const newVerificationToken = generateVerificationToken();
    const newVerificationExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    console.log('[RESEND_VERIFICATION] 更新驗證 token 到資料庫');
    await db
      .update(emailUsersTable)
      .set({
        emailVerificationToken: newVerificationToken,
        emailVerificationExpires: newVerificationExpires,
        lastVerificationEmailSent: now,
        updatedAt: now
      })
      .where(eq(emailUsersTable.userId, emailUserQuery.id));

    console.log('[RESEND_VERIFICATION] 發送驗證信');
    const emailResult = await sendVerificationEmail(
      emailUserQuery.email,
      newVerificationToken,
      emailUserQuery.username
    );

    if (!emailResult.success) {
      console.error('[RESEND_VERIFICATION] 驗證信發送失敗:', emailResult.error);
      
      return res.status(500).json({
        success: false,
        error: 'EMAIL_SEND_FAILED',
        message: '發送驗證信失敗，請稍後再試',
        timestamp: new Date().toISOString()
      });
    }

    console.log('[RESEND_VERIFICATION] 驗證信發送成功:', { 
      userId: emailUserQuery.id,
      email: emailUserQuery.email,
      messageId: emailResult.messageId 
    });

    return res.json({
      success: true,
      message: '驗證信已發送，請檢查您的信箱',
      data: {
        email: emailUserQuery.email,
        messageId: emailResult.messageId
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[RESEND_VERIFICATION] 重新發送驗證信失敗:', error);
    
    return res.status(500).json({
      success: false,
      error: 'RESEND_VERIFICATION_FAILED',
      message: '重新發送驗證信失敗',
      timestamp: new Date().toISOString()
    });
  }
};

export {
  signup,
  login,
  verifyEmail,
  resendVerificationEmail
};
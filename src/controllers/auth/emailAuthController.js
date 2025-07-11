import bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { usersTable, emailUsersTable, userProfilesTable } from '../../models/schema.js';
import { loginUser } from '../../services/auth/authService.js';

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
            isVerifiedEmail: true
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

    console.log('[EMAIL_SIGNUP] 註冊完成:', { 
      userId: result.user.id, 
      username: result.user.username,
      email: result.user.email 
    });

    return res.status(201).json({
      success: true,
      message: '註冊成功！',
      data: {
        userId: result.user.id,
        username: result.user.username,
        email: result.user.email,
        redirectUrl: '/login',
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
      hasPassword: !!userQuery.password 
    });

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

export {
  signup,
  login
};
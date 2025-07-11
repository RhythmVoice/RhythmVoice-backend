import express from 'express';
import { authMiddleware, optionalAuthMiddleware, requireAdmin, getCurrentUser } from '../middlewares/auth/authMiddleware.js';
import { csrfProtection, refreshCSRFToken, provideCSRFToken, getCSRFStatus } from '../middlewares/auth/csrfProtection.js';
import { logoutUser, attemptTokenRefresh, getAuthStats } from '../services/auth/authService.js';
import { generateCSRFToken, clearAuthCookies } from '../services/auth/cookieService.js';
import { cookieConfig } from '../config/cookies.js';

// import emailAuthRoutes from './auth/emailAuthRoutes.js';

const router = express.Router();

// ==========================================
// 全域中間件 - 自動 CSRF Cookie 設置
// ==========================================
router.use((req, res, next) => {
  // 對所有 GET 請求自動設置 CSRF Cookie（如果不存在）
  if (req.method === 'GET' && !req.cookies.csrf_token) {
    const csrfToken = generateCSRFToken();
    res.cookie('csrf_token', csrfToken, cookieConfig.csrf_token);
    
    console.log('[CSRF_AUTO] 自動設置 CSRF Cookie:', {
      path: req.path,
      ip: req.ip
    });
  }
  next();
});

// ==========================================
// 認證相關的通用 API 端點
// ==========================================

// 獲取認證狀態（包含 CSRF 資訊）
router.get('/auth/status', optionalAuthMiddleware, provideCSRFToken, (req, res) => {
  try {
    const csrfStatus = getCSRFStatus(req);
    
    const response = {
      success: true,
      authenticated: !!req.user,
      timestamp: new Date().toISOString(),
      csrf: {
        token: res.locals.csrfToken,
        status: csrfStatus
      }
    };

    if (req.user) {
      response.user = {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        providerType: req.user.providerType,
        authenticatedAt: req.user.authenticatedAt
      };

      if (req.userInfo) {
        response.profile = req.userInfo;
      }
    }

    console.log(`[AUTH_STATUS] 認證狀態查詢`, {
      authenticated: response.authenticated,
      userId: req.user?.id || 'anonymous',
      ip: req.ip,
      path: req.path
    });

    res.json(response);
  } catch (error) {
    console.error('[AUTH_STATUS] 獲取認證狀態失敗:', error);
    
    res.status(500).json({
      success: false,
      error: 'STATUS_CHECK_FAILED',
      message: '無法獲取認證狀態',
      timestamp: new Date().toISOString()
    });
  }
});

// 獲取 CSRF Token（獨立端點，供需要時使用）
router.get('/auth/csrf-token', refreshCSRFToken, (req, res) => {
  try {
    const csrfToken = res.locals.csrfToken;
    const userAgent = req.get('User-Agent');
    console.log(`[CSRF_TOKEN] CSRF token 請求`, {
      ip: req.ip,
      userAgent: userAgent?.length > 50 ? userAgent.substring(0, 47) + '...' : userAgent
    });

    res.json({
      success: true,
      csrfToken: csrfToken,
      message: 'CSRF token 已生成',
      timestamp: new Date().toISOString(),
      usage: {
        header: 'X-CSRF-Token',
        cookieName: 'csrf_token'
      }
    });
  } catch (error) {
    console.error('[CSRF_TOKEN] 生成 CSRF token 失敗:', error);
    
    res.status(500).json({
      success: false,
      error: 'CSRF_TOKEN_GENERATION_FAILED',
      message: '無法生成 CSRF token',
      timestamp: new Date().toISOString()
    });
  }
});

// 統一登出端點
router.post('/auth/logout', authMiddleware, csrfProtection, async (req, res) => {
  try {
    const { allDevices = false } = req.body;
    
    const result = await logoutUser(req, res, { allDevices });
    
    console.log(`[LOGOUT] 用戶登出`, {
      success: result.success,
      userId: req.user.id,
      username: req.user.username,
      allDevices,
      ip: req.ip
    });

    res.json({
      success: true,
      message: '登出成功',
      data: {
        redirectUrl: result.redirectUrl || '/login',
        allDevices
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[LOGOUT] 登出處理失敗:', error);
    
    // 即使失敗也清除 Cookie
    clearAuthCookies(res);
    
    res.json({
      success: true,
      message: '登出成功',
      data: {
        redirectUrl: '/login'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 手動刷新 Token
router.post('/auth/refresh', async (req, res) => {
  try {
		const userAgent = req.get('User-Agent');
    console.log(`[TOKEN_REFRESH] 手動 token 刷新請求`, {
      ip: req.ip,
      userAgent: userAgent?.length > 50 ? userAgent.substring(0, 47) + '...' : userAgent
    });

    const refreshResult = await attemptTokenRefresh(req, res);

    if (refreshResult.success) {
      console.log(`[TOKEN_REFRESH] Token 刷新成功`, {
        userId: refreshResult.user?.id
      });

      res.json({
        success: true,
        message: 'Token 已刷新',
        data: {
          user: refreshResult.user,
          refreshed: true
        },
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`[TOKEN_REFRESH] Token 刷新失敗`, {
        error: refreshResult.error,
        message: refreshResult.message
      });

      res.status(401).json({
        success: false,
        error: refreshResult.error,
        message: refreshResult.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('[TOKEN_REFRESH] Token 刷新發生錯誤:', error);
    
    res.status(500).json({
      success: false,
      error: 'TOKEN_REFRESH_ERROR',
      message: 'Token 刷新失敗',
      timestamp: new Date().toISOString()
    });
  }
});

// 獲取用戶詳細資料
router.get('/auth/profile', authMiddleware, getCurrentUser, (req, res) => {
  try {
    const userProfile = {
      success: true,
      data: {
        user: res.locals.currentUser,
        permissions: res.locals.currentUser.permissions,
        authInfo: {
          authMethod: req.user.authMethod,
          authenticatedAt: req.user.authenticatedAt,
          providerType: req.user.providerType
        }
      },
      timestamp: new Date().toISOString()
    };

    console.log(`[USER_PROFILE] 用戶資料查詢`, {
      userId: req.user.id,
      username: req.user.username
    });

    res.json(userProfile);
  } catch (error) {
    console.error('[USER_PROFILE] 獲取用戶資料失敗:', error);
    
    res.status(500).json({
      success: false,
      error: 'PROFILE_FETCH_FAILED',
      message: '無法獲取用戶資料',
      timestamp: new Date().toISOString()
    });
  }
});

// ==========================================
// 各種登入方式的路由模組
// ==========================================

// Email 身份驗證路由
// router.use('/auth/email', emailAuthRoutes);

// ==========================================
// 系統管理端點
// ==========================================

// 系統資訊（僅管理員）
router.get('/system/info', authMiddleware, requireAdmin, (req, res) => {
  try {
    const systemInfo = getAuthStats();
    
    console.log(`[SYSTEM_INFO] 管理員查詢系統資訊`, {
      adminId: req.user.id,
      adminUsername: req.user.username
    });

    res.json({
      success: true,
      data: {
        authSystem: systemInfo,
        server: {
          nodeEnv: process.env.NODE_ENV,
          nodeVersion: process.version,
          uptime: Math.floor(process.uptime()),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SYSTEM_INFO] 獲取系統資訊失敗:', error);
    
    res.status(500).json({
      success: false,
      error: 'SYSTEM_INFO_FAILED',
      message: '無法獲取系統資訊',
      timestamp: new Date().toISOString()
    });
  }
});

// 健康檢查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'authentication-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// ==========================================
// 開發和測試端點
// ==========================================

if (process.env.NODE_ENV !== 'production') {
  // 認證測試
  router.get('/test/auth', authMiddleware, (req, res) => {
    res.json({
      success: true,
      message: '認證測試成功',
      data: {
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role,
          providerType: req.user.providerType
        }
      },
      timestamp: new Date().toISOString()
    });
  });

  // 管理員權限測試
  router.get('/test/admin', authMiddleware, requireAdmin, (req, res) => {
    res.json({
      success: true,
      message: '管理員權限測試成功',
      data: {
        admin: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role
        }
      },
      timestamp: new Date().toISOString()
    });
  });

  // CSRF 保護測試
  router.post('/test/csrf', authMiddleware, csrfProtection, (req, res) => {
    res.json({
      success: true,
      message: 'CSRF 保護測試成功',
      data: {
        receivedData: req.body
      },
      timestamp: new Date().toISOString()
    });
  });
}

export default router;
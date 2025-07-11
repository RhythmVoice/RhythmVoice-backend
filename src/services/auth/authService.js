import { setAuthCookies, clearAuthCookies, getAuthFromCookies, refreshAuthCookies, validateAuthCookies, needsTokenRefresh, validateCSRFToken, updateUserDisplayCookie } from './cookieService.js';

const validateUserInfo = (user) => {
  console.log('[AUTH] 開始驗證用戶資訊:', { 
    userId: user?.id, 
    username: user?.username, 
    providerType: user?.providerType 
  });

  const requiredFields = ['id', 'username', 'providerType'];
  
  for (const field of requiredFields) {
    if (!user[field]) {
      console.error('[AUTH] 用戶資訊驗證失敗 - 缺少必要欄位:', field);
      return {
        success: false,
        error: 'INVALID_USER_INFO',
        message: `缺少必要的用戶資訊: ${field}`
      };
    }
  }

  if (user.providerType === 'email' && !user.email) {
    console.error('[AUTH] Email 登入方式缺少 email');
    return {
      success: false,
      error: 'EMAIL_REQUIRED',
      message: 'Email 登入方式需要提供有效的 email'
    };
  }

  // 其他登入方式（google, line）不強制要求 email
  const validProviders = ['email', 'google', 'line'];
  if (!validProviders.includes(user.providerType)) {
    console.error('[AUTH] 不支援的登入方式:', user.providerType);
    return {
      success: false,
      error: 'INVALID_PROVIDER_TYPE',
      message: '不支援的登入方式'
    };
  }

  if (user.role && !['user', 'admin', 'moderator'].includes(user.role)) {
    console.error('[AUTH] 無效的用戶角色:', user.role);
    return {
      success: false,
      error: 'INVALID_ROLE',
      message: '無效的用戶角色'
    };
  }

  console.log('[AUTH] 用戶資訊驗證通過');
  return {
    success: true,
    message: '用戶資訊驗證通過'
  };
};

const loginUser = async (res, user, options = {}) => {
  console.log('[AUTH] 開始登入流程:', { 
    userId: user?.id, 
    providerType: user?.providerType, 
    rememberMe: options.rememberMe 
  });

  try {
    const validation = validateUserInfo(user);
    if (!validation.success) {
      console.error('[AUTH] 登入失敗 - 用戶資訊驗證未通過:', validation.error);
      return validation;
    }

    console.log('[AUTH] 開始設定認證 Cookie');
    const cookieResult = setAuthCookies(res, user, {
      rememberMe: options.rememberMe || false
    });

    if (!cookieResult.success) {
      console.error('[AUTH] 登入失敗 - Cookie 設定失敗:', cookieResult.error);
      return cookieResult;
    }

    console.log('[AUTH] 登入成功:', {
      userId: user.id,
      username: user.username,
      providerType: user.providerType,
      hasEmail: !!user.email,
      rememberMe: options.rememberMe || false,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: '登入成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        providerType: user.providerType,
        avatarUrl: user.avatarUrl || null,
      },
      redirectUrl: options.redirectUrl || '/dashboard'
    };
  } catch (error) {
    console.error('[AUTH] 統一登入處理失敗:', error);
    
    console.error('[AUTH] 登入失敗:', {
      userId: user?.id || 'unknown',
      error: error.message,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      error: 'LOGIN_FAILED',
      message: '登入處理失敗，請重試'
    };
  }
};

const logoutUser = async (req, res, options = {}) => {
  try {
    const cookieAuth = getAuthFromCookies(req);
    const userInfo = cookieAuth.userInfo;

    const clearResult = clearAuthCookies(res);

    if (!clearResult.success) {
      console.error('[AUTH] 清除 Cookie 失敗:', clearResult.error);
    }

    console.log('[AUTH] 登出成功:', {
      userId: userInfo?.id || 'unknown',
      username: userInfo?.username || 'unknown',
      allDevices: options.allDevices || false,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: '登出成功',
      redirectUrl: '/login'
    };
  } catch (error) {
    console.error('[AUTH] 統一登出處理失敗:', error);

    // 即使發生錯誤，也要清除 Cookie
    try {
      clearAuthCookies(res);
    } catch (clearError) {
      console.error('[AUTH] 強制清除 Cookie 失敗:', clearError);
    }

    console.error('[AUTH] 登出錯誤:', {
      error: error.message,
      timestamp: new Date().toISOString()
    });

    return {
      success: true, // 對用戶來說登出成功
      message: '登出成功',
      redirectUrl: '/login',
      warning: '登出過程中發生一些問題，但已成功清除本地認證資訊'
    };
  }
};

const attemptTokenRefresh = async (req, res) => {
  console.log('[AUTH] 嘗試刷新 Token');
  
  try {
    const cookieAuth = getAuthFromCookies(req);
    
    if (!cookieAuth.hasRefreshToken) {
      console.warn('[AUTH] Token 刷新失敗 - 沒有 refresh token');
      return {
        success: false,
        error: 'NO_REFRESH_CAPABILITY',
        message: '無法自動刷新，請重新登入'
      };
    }

    const latestUserInfo = cookieAuth.userInfo;
    console.log('[AUTH] 找到 refresh token，開始刷新流程:', { 
      userId: latestUserInfo?.id 
    });

    const refreshResult = refreshAuthCookies(req, res, latestUserInfo);

    if (refreshResult.success) {
      console.log('[AUTH] Token 刷新成功:', {
        userId: refreshResult.userId,
        timestamp: new Date().toISOString()
      });

      const newValidation = validateAuthCookies(req);
      
      return {
        success: true,
        user: newValidation.user,
        userInfo: latestUserInfo,
        message: 'Token 已自動刷新',
        refreshed: true
      };
    }

    console.error('[AUTH] Token 刷新失敗:', refreshResult.error);
    return refreshResult;
  } catch (error) {
    console.error('[AUTH] Token 自動刷新失敗:', error);
    return {
      success: false,
      error: 'AUTO_REFRESH_FAILED',
      message: 'Token 自動刷新失敗，請重新登入'
    };
  }
};

const verifyAuth = async (req, res) => {
  console.log('[AUTH] 開始驗證認證狀態');
  
  try {
    const validationResult = validateAuthCookies(req);

    if (!validationResult.success) {
      console.warn('[AUTH] Cookie 驗證失敗:', validationResult.error);
      
      if (validationResult.needsRefresh) {
        console.log('[AUTH] Token 已過期，嘗試自動刷新');
        return attemptTokenRefresh(req, res);
      }

      return validationResult;
    }

    console.log('[AUTH] Cookie 驗證成功，檢查是否需要刷新');
    
    if (needsTokenRefresh(req)) {
      console.log('[AUTH] Token 即將過期，執行預防性刷新');
      const refreshResult = await attemptTokenRefresh(req, res);
      if (refreshResult.success) {
        return refreshResult;
      }
    }

    console.log('[AUTH] 認證驗證完成 - 狀態正常');
    return {
      success: true,
      user: validationResult.user,
      userInfo: validationResult.userInfo,
      message: '認證驗證成功'
    };
  } catch (error) {
    console.error('[AUTH] 驗證認證狀態失敗:', error);
    return {
      success: false,
      error: 'AUTH_VERIFICATION_FAILED',
      message: '認證驗證失敗'
    };
  }
};

const validateCSRF = (req) => {
  console.log('[AUTH] 開始 CSRF token 驗證');
  const result = validateCSRFToken(req);
  
  if (result.success) {
    console.log('[AUTH] CSRF token 驗證通過');
  } else {
    console.error('[AUTH] CSRF token 驗證失敗:', result.error);
  }
  
  return result;
};

const updateUserInfo = (res, updatedUserInfo) => {
  try {
    const updateResult = updateUserDisplayCookie(res, updatedUserInfo);

    if (updateResult.success) {
      console.log('[AUTH] 用戶資訊更新成功:', {
        userId: updatedUserInfo.id,
        fields: Object.keys(updatedUserInfo),
        timestamp: new Date().toISOString()
      });
    }

    return updateResult;
  } catch (error) {
    console.error('[AUTH] 更新用戶資訊失敗:', error);
    return {
      success: false,
      error: 'UPDATE_USER_INFO_FAILED',
      message: '更新用戶資訊失敗'
    };
  }
};

const hasPermission = (user, requiredRole) => {
  const roleHierarchy = {
    'user': 1,
    'moderator': 2,
    'admin': 3
  };

  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
};

const createAuthResponse = (success, data = {}, message = '') => {
  const response = {
    success,
    timestamp: new Date().toISOString()
  };

  if (success) {
    response.message = message || '操作成功';
    response.data = data;
  } else {
    response.error = data.error || 'UNKNOWN_ERROR';
    response.message = message || data.message || '操作失敗';
  }

  return response;
};

const getAuthStats = () => {
  return {
    supportedProviders: ['email', 'google', 'line'],
    supportedRoles: ['user', 'moderator', 'admin'],
    tokenExpiry: {
      access: process.env.ACCESS_TOKEN_EXPIRES_IN || '2h',
      refresh: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
    },
    securityFeatures: [
      'CSRF Protection',
      'HTTP-Only Cookies', 
      'Secure Cookies (Production)',
      'SameSite Strict',
      'Automatic Token Refresh',
      'Role-based Access Control'
    ]
  };
};

export {
  loginUser,
  logoutUser,
  verifyAuth,
  attemptTokenRefresh,
  validateCSRF,
  updateUserInfo,
  validateUserInfo,
  hasPermission,
  createAuthResponse,
  getAuthStats
};
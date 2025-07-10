import cookieService from './cookieService.js';

const validateUserInfo = (user) => {
  const requiredFields = ['id', 'username', 'providerType'];
  
  for (const field of requiredFields) {
    if (!user[field]) {
      return {
        success: false,
        error: 'INVALID_USER_INFO',
        message: `缺少必要的用戶資訊: ${field}`
      };
    }
  }

  if (user.providerType === 'email' && !user.email) {
    return {
      success: false,
      error: 'EMAIL_REQUIRED',
      message: 'Email 登入方式需要提供有效的 email'
    };
  }

  // 其他登入方式（google, line）不強制要求 email
  const validProviders = ['email', 'google', 'line'];
  if (!validProviders.includes(user.providerType)) {
    return {
      success: false,
      error: 'INVALID_PROVIDER_TYPE',
      message: '不支援的登入方式'
    };
  }

  if (user.role && !['user', 'admin', 'moderator'].includes(user.role)) {
    return {
      success: false,
      error: 'INVALID_ROLE',
      message: '無效的用戶角色'
    };
  }

  return {
    success: true,
    message: '用戶資訊驗證通過'
  };
};

const loginUser = async (res, user, options = {}) => {
  try {
    const validation = validateUserInfo(user);
    if (!validation.success) {
      return validation;
    }

    const cookieResult = cookieService.setAuthCookies(res, user, {
      rememberMe: options.rememberMe || false
    });

    if (!cookieResult.success) {
      return cookieResult;
    }

    logAuthEvent('LOGIN_SUCCESS', {
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
    console.error('統一登入處理失敗:', error);
    
    logAuthEvent('LOGIN_FAILED', {
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
    const cookieAuth = cookieService.getAuthFromCookies(req);
    const userInfo = cookieAuth.userInfo;

    const clearResult = cookieService.clearAuthCookies(res);

    if (!clearResult.success) {
      return clearResult;
    }

    logAuthEvent('LOGOUT_SUCCESS', {
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
    console.error('統一登出處理失敗:', error);

    // 即使發生錯誤，也要清除 Cookie
    cookieService.clearAuthCookies(res);

    return {
      success: true, // 對用戶來說登出成功
      message: '登出成功',
      redirectUrl: '/login'
    };
  }
};

const attemptTokenRefresh = async (req, res) => {
  try {
    const cookieAuth = cookieService.getAuthFromCookies(req);
    
    if (!cookieAuth.hasRefreshToken) {
      return {
        success: false,
        error: 'NO_REFRESH_CAPABILITY',
        message: '無法自動刷新，請重新登入'
      };
    }

    const latestUserInfo = cookieAuth.userInfo;

    const refreshResult = cookieService.refreshAuthCookies(req, res, latestUserInfo);

    if (refreshResult.success) {
      logAuthEvent('TOKEN_REFRESHED', {
        userId: refreshResult.userId,
        timestamp: new Date().toISOString()
      });

      const newValidation = cookieService.validateAuthCookies(req);
      
      return {
        success: true,
        user: newValidation.user,
        userInfo: latestUserInfo,
        message: 'Token 已自動刷新',
        refreshed: true
      };
    }

    return refreshResult;
  } catch (error) {
    console.error('Token 自動刷新失敗:', error);
    return {
      success: false,
      error: 'AUTO_REFRESH_FAILED',
      message: 'Token 自動刷新失敗，請重新登入'
    };
  }
};

const verifyAuth = async (req, res) => {
  try {
    const validationResult = cookieService.validateAuthCookies(req);

    if (!validationResult.success) {
      if (validationResult.needsRefresh) {
        return attemptTokenRefresh(req, res);
      }

      return validationResult;
    }

    if (cookieService.needsTokenRefresh(req)) {
      const refreshResult = await attemptTokenRefresh(req, res);
      if (refreshResult.success) {
        return refreshResult;
      }
    }

    return {
      success: true,
      user: validationResult.user,
      userInfo: validationResult.userInfo,
      message: '認證驗證成功'
    };
  } catch (error) {
    console.error('驗證認證狀態失敗:', error);
    return {
      success: false,
      error: 'AUTH_VERIFICATION_FAILED',
      message: '認證驗證失敗'
    };
  }
};

const validateCSRF = (req) => {
  return cookieService.validateCSRFToken(req);
};

const updateUserInfo = (res, updatedUserInfo) => {
  try {
    const updateResult = cookieService.updateUserDisplayCookie(res, updatedUserInfo);

    if (updateResult.success) {
      logAuthEvent('USER_INFO_UPDATED', {
        userId: updatedUserInfo.id,
        fields: Object.keys(updatedUserInfo),
        timestamp: new Date().toISOString()
      });
    }

    return updateResult;
  } catch (error) {
    console.error('更新用戶資訊失敗:', error);
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

const logAuthEvent = (event, details) => {
  try {
    console.log(`[AUTH_EVENT] ${event}:`, {
      event,
      ...details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown'
    });

  } catch (error) {
    console.error('記錄認證事件失敗:', error);
  }
};

const getAuthStats = () => {
  return {
    supportedProviders: ['email', 'google', 'line'],
    supportedRoles: ['user', 'moderator', 'admin'],
    tokenExpiry: {
      access: '7 days',
      refresh: '30 days'
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
  logAuthEvent,
  getAuthStats
};
import { verifyAuth, hasPermission, logAuthEvent } from '../../services/auth/authService.js';

const authMiddleware = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const clientInfo = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      method: req.method,
      path: req.path
    };

    console.log(`[AUTH] 認證請求開始 - ${req.method} ${req.path}`, {
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent?.substring(0, 100) + '...'
    });

    const authResult = await verifyAuth(req, res);

    if (!authResult.success) {
      console.log(`[AUTH] 認證失敗 - ${authResult.error}`, {
        ip: clientInfo.ip,
        path: req.path,
        error: authResult.error,
        message: authResult.message
      });

      logAuthEvent('AUTH_FAILED', {
        ...clientInfo,
        error: authResult.error,
        message: authResult.message,
        timestamp: new Date().toISOString()
      });

      return res.status(401).json({
        success: false,
        error: authResult.error,
        message: authResult.message,
        timestamp: new Date().toISOString()
      });
    }

    req.user = {
      id: authResult.user.id,
      username: authResult.user.username,
      email: authResult.user.email,
      role: authResult.user.role,
      providerType: authResult.user.providerType,
      authMethod: 'cookie',
      authenticatedAt: new Date().toISOString()
    };

    if (authResult.userInfo) {
      req.userInfo = authResult.userInfo;
    }

    if (authResult.refreshed) {
      console.log(`[AUTH] Token 已自動刷新`, {
        userId: req.user.id,
        username: req.user.username
      });
    }

    const authDuration = Date.now() - startTime;
    
    console.log(`[AUTH] 認證成功 - ${req.method} ${req.path}`, {
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      providerType: req.user.providerType,
      duration: `${authDuration}ms`,
      refreshed: authResult.refreshed || false
    });

    if (process.env.NODE_ENV === 'development') {
      logAuthEvent('AUTH_SUCCESS', {
        ...clientInfo,
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        duration: authDuration,
        refreshed: authResult.refreshed || false,
        timestamp: new Date().toISOString()
      });
    }

    next();
  } catch (error) {
    console.error('[AUTH] 認證中間件發生未預期錯誤:', error);

    logAuthEvent('AUTH_SYSTEM_ERROR', {
      ip: req.ip,
      path: req.path,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'AUTHENTICATION_ERROR',
      message: '認證系統錯誤，請稍後再試',
      timestamp: new Date().toISOString()
    });
  }
};

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    console.log(`[OPTIONAL_AUTH] 可選認證 - ${req.method} ${req.path}`);

    const authResult = await verifyAuth(req, res);

    if (authResult.success) {
      req.user = {
        id: authResult.user.id,
        username: authResult.user.username,
        email: authResult.user.email,
        role: authResult.user.role,
        providerType: authResult.user.providerType,
        authMethod: 'cookie',
        authenticatedAt: new Date().toISOString()
      };

      if (authResult.userInfo) {
        req.userInfo = authResult.userInfo;
      }

      console.log(`[OPTIONAL_AUTH] 發現有效認證`, {
        userId: req.user.id,
        username: req.user.username
      });
    } else {
      req.user = null;
      req.userInfo = null;
      
      console.log(`[OPTIONAL_AUTH] 無有效認證，繼續處理`, {
        error: authResult.error
      });
    }

    next();
  } catch (error) {
    console.error('[OPTIONAL_AUTH] 可選認證發生錯誤:', error);
    
    req.user = null;
    req.userInfo = null;
    
    next();
  }
};

const requireRole = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  return (req, res, next) => {
    try {
      if (!req.user) {
        console.log(`[ROLE_CHECK] 未認證用戶嘗試存取需要角色 [${roles.join(', ')}] 的資源`);
        
        return res.status(401).json({
          success: false,
          error: 'AUTHENTICATION_REQUIRED',
          message: '需要登入才能存取此資源',
          timestamp: new Date().toISOString()
        });
      }

      const userRole = req.user.role;
      const hasRolePermission = roles.some(role => hasPermission(req.user, role));

      if (!hasRolePermission) {
        console.log(`[ROLE_CHECK] 權限不足`, {
          userId: req.user.id,
          userRole: userRole,
          requiredRoles: roles,
          path: req.path
        });

        logAuthEvent('ACCESS_DENIED', {
          userId: req.user.id,
          username: req.user.username,
          userRole: userRole,
          requiredRoles: roles,
          path: req.path,
          ip: req.ip,
          timestamp: new Date().toISOString()
        });

        return res.status(403).json({
          success: false,
          error: 'INSUFFICIENT_PERMISSIONS',
          message: '權限不足，無法存取此資源',
          required: roles,
          current: userRole,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`[ROLE_CHECK] 權限檢查通過`, {
        userId: req.user.id,
        userRole: userRole,
        requiredRoles: roles
      });

      next();
    } catch (error) {
      console.error('[ROLE_CHECK] 角色檢查發生錯誤:', error);
      
      return res.status(500).json({
        success: false,
        error: 'ROLE_CHECK_ERROR',
        message: '權限檢查失敗',
        timestamp: new Date().toISOString()
      });
    }
  };
};

const requireAdmin = requireRole('admin');

const requireModerator = requireRole(['moderator', 'admin']);

const getCurrentUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: '需要登入才能獲取用戶資訊',
      timestamp: new Date().toISOString()
    });
  }

  res.locals.currentUser = {
    ...req.user,
    displayInfo: req.userInfo || null,
    permissions: {
      isAdmin: hasPermission(req.user, 'admin'),
      isModerator: hasPermission(req.user, 'moderator')
    }
  };

  next();
};

export {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireAdmin,
  requireModerator,
  getCurrentUser
};
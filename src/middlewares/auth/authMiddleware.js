import { verifyAuth, hasPermission } from '../../services/auth/authService.js';

const authMiddleware = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const clientInfo = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      method: req.method,
      path: req.path
    };

    console.log(`[AUTH_MW] 認證請求開始 - ${req.method} ${req.path}`, {
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent?.length > 100 
        ? clientInfo.userAgent.substring(0, 97) + '...' 
        : clientInfo.userAgent
    });

    const authResult = await verifyAuth(req, res);

    if (!authResult.success) {
      console.error(`[AUTH_MW] 認證失敗 - ${authResult.error}`, {
        ip: clientInfo.ip,
        path: req.path,
        error: authResult.error,
        message: authResult.message
      });

      return res.status(401).json({
        success: false,
        error: authResult.error,
        message: authResult.message,
        timestamp: new Date().toISOString()
      });
    }

    // 設定用戶資訊到 request 物件
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
      console.log(`[AUTH_MW] Token 已自動刷新`, {
        userId: req.user.id,
        username: req.user.username
      });
    }

    const authDuration = Date.now() - startTime;
    
    console.log(`[AUTH_MW] 認證成功 - ${req.method} ${req.path}`, {
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      providerType: req.user.providerType,
      duration: `${authDuration}ms`,
      refreshed: authResult.refreshed || false
    });

    next();
  } catch (error) {
    console.error('[AUTH_MW] 認證中間件發生未預期錯誤:', error);

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
    
    // 確保即使出錯也能繼續處理
    req.user = null;
    req.userInfo = null;
    
    next();
  }
};

const requireRole = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  return (req, res, next) => {
    try {
      console.log(`[ROLE_CHECK] 檢查角色權限:`, {
        requiredRoles: roles,
        userId: req.user?.id || 'anonymous'
      });

      if (!req.user) {
        console.warn(`[ROLE_CHECK] 未認證用戶嘗試存取需要角色 [${roles.join(', ')}] 的資源`);
        
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
        console.error(`[ROLE_CHECK] 權限不足`, {
          userId: req.user.id,
          userRole: userRole,
          requiredRoles: roles,
          path: req.path
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
  console.log('[GET_USER] 獲取當前用戶資訊:', { 
    userId: req.user?.id || 'anonymous' 
  });

  if (!req.user) {
    console.warn('[GET_USER] 嘗試獲取用戶資訊但未認證');
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

  console.log('[GET_USER] 用戶資訊設定完成:', {
    userId: req.user.id,
    isAdmin: res.locals.currentUser.permissions.isAdmin,
    isModerator: res.locals.currentUser.permissions.isModerator
  });

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
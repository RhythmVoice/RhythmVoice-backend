import { validateCSRF, logAuthEvent } from '../../services/auth/authService.js';
import { generateCSRFToken } from '../../services/auth/cookieService.js';

const csrfProtection = (req, res, next) => {
  try {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    
    if (safeMethods.includes(req.method)) {
      console.log(`[CSRF] 安全方法 ${req.method}，跳過 CSRF 檢查`);
      return next();
    }

    console.log(`[CSRF] 檢查 ${req.method} ${req.path} 的 CSRF token`);

    const csrfResult = validateCSRF(req);

    if (!csrfResult.success) {
      console.log(`[CSRF] CSRF 驗證失敗`, {
        error: csrfResult.error,
        message: csrfResult.message,
        method: req.method,
        path: req.path,
        ip: req.ip,
        referer: req.get('Referer')
      });

      logAuthEvent('CSRF_ATTACK_BLOCKED', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        origin: req.get('Origin'),
        userId: req.user?.id || 'anonymous',
        error: csrfResult.error,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        success: false,
        error: csrfResult.error,
        message: csrfResult.message,
        timestamp: new Date().toISOString(),
        help: {
          message: '請確保在請求中包含有效的 CSRF token',
          headerName: 'X-CSRF-Token',
          cookieName: 'csrf_token'
        }
      });
    }

    console.log(`[CSRF] CSRF 驗證成功 - ${req.method} ${req.path}`);
    next();
  } catch (error) {
    console.error('[CSRF] CSRF 保護發生錯誤:', error);

    logAuthEvent('CSRF_SYSTEM_ERROR', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'CSRF_PROTECTION_ERROR',
      message: 'CSRF 保護系統錯誤',
      timestamp: new Date().toISOString()
    });
  }
};

const conditionalCSRFProtection = (req, res, next) => {
  try {
    if (!req.user) {
      console.log(`[CONDITIONAL_CSRF] 未認證用戶，跳過 CSRF 檢查`);
      return next();
    }

    console.log(`[CONDITIONAL_CSRF] 已認證用戶，執行 CSRF 檢查`, {
      userId: req.user.id,
      username: req.user.username
    });

    return csrfProtection(req, res, next);
  } catch (error) {
    console.error('[CONDITIONAL_CSRF] 條件式 CSRF 保護發生錯誤:', error);
    return next();
  }
};

const refreshCSRFToken = (req, res, next) => {
  try {
    console.log(`[CSRF_REFRESH] 刷新 CSRF token`);

    const newCSRFToken = generateCSRFToken();
    
    res.cookie('csrf_token', newCSRFToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, 
      path: '/'
    });

    res.set('X-CSRF-Token', newCSRFToken);

    res.locals.csrfToken = newCSRFToken;

    console.log(`[CSRF_REFRESH] CSRF token 已刷新`);
    next();
  } catch (error) {
    console.error('[CSRF_REFRESH] 刷新 CSRF token 失敗:', error);
    
    next();
  }
};

const provideCSRFToken = (req, res, next) => {
  try {
    const csrfToken = req.cookies?.csrf_token;
    
    if (csrfToken) {
      res.set('X-CSRF-Token', csrfToken);
      res.locals.csrfToken = csrfToken;
      
      console.log(`[CSRF_PROVIDE] 提供現有 CSRF token`);
    } else {
      console.log(`[CSRF_PROVIDE] 沒有找到 CSRF token，建議刷新`);
    }

    next();
  } catch (error) {
    console.error('[CSRF_PROVIDE] 提供 CSRF token 失敗:', error);
    next();
  }
};

const getCSRFStatus = (req) => {
  const csrfToken = req.cookies?.csrf_token;
  const headerCSRF = req.headers['x-csrf-token'];
  const bodyCSRF = req.body?._csrf;

  return {
    hasCookieToken: !!csrfToken,
    hasHeaderToken: !!headerCSRF,
    hasBodyToken: !!bodyCSRF,
    tokensMatch: csrfToken && (csrfToken === headerCSRF || csrfToken === bodyCSRF),
    method: req.method,
    needsProtection: !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
  };
};

export {
  csrfProtection,
  conditionalCSRFProtection,
  refreshCSRFToken,
  provideCSRFToken,
  getCSRFStatus
};
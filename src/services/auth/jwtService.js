import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

if (!JWT_SECRET || !REFRESH_SECRET) {
  console.error('Missing required environment variables: JWT_SECRET, REFRESH_SECRET');
  process.exit(1);
}

// JWT 配置
const JWT_CONFIG = {
  access: {
    secret: JWT_SECRET,
    expiresIn: '2h'      
  },
  refresh: {
    secret: REFRESH_SECRET,
    expiresIn: '7d'   
  }
};

const generateAccessToken = (payload) => {
  try {
    const tokenPayload = {
      id: payload.id,
      username: payload.username,
      email: payload.email,
      role: payload.role || 'user',
      providerType: payload.providerType,
      type: 'access',
    };

    return jwt.sign(
			tokenPayload, 
			JWT_CONFIG.access.secret, 
			{ 
				expiresIn: JWT_CONFIG.access.expiresIn 
			});
  } catch (error) {
    console.error('生成 Access Token 失敗:', error);
    throw new Error('Token 生成失敗');
  }
};

const generateRefreshToken = (payload) => {
  try {
    const tokenPayload = { 
      id: payload.id, 
      role: payload.role || 'user', 
      type: 'refresh', 
    };
    return jwt.sign(
			tokenPayload, 
			JWT_CONFIG.refresh.secret, 
			{ 
				expiresIn: JWT_CONFIG.refresh.expiresIn 
			});
  } catch (error) {
    console.error('生成 Refresh Token 失敗:', error);
    throw new Error('Refresh Token 生成失敗');
  }
};

const generateTokenPair = (userPayload) => {
  try {
    const accessToken = generateAccessToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);

    return {
      success: true,
      accessToken,
      refreshToken
    };
  } catch (error) {
    console.error('生成 Token 對失敗:', error);
    return {
      success: false,
      error: 'TOKEN_GENERATION_FAILED',
      message: 'Token 生成失敗'
    };
  }
};

const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.access.secret);
    
    // 檢查 token 類型
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return {
      success: true,
      data: decoded
    };
  } catch (error) {
    console.error('Access Token 驗證失敗:', error.message);
    
    return {
      success: false,
      error: error.name,
      message: getErrorMessage(error)
    };
  }
};

const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.refresh.secret);
    
    // 檢查 token 類型
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return {
      success: true,
      data: decoded
    };
  } catch (error) {
    console.error('Refresh Token 驗證失敗:', error.message);
    
    return {
      success: false,
      error: error.name,
      message: getErrorMessage(error)
    };
  }
};

const refreshAccessToken = (refreshToken, userInfo) => {
  try {
    const refreshResult = verifyRefreshToken(refreshToken);
    
    if (!refreshResult.success) {
      return refreshResult;
    }

    const refreshData = refreshResult.data;
    
    // 生成新的 Access Token
    const newAccessToken = generateAccessToken({
      id: refreshData.id,
      username: userInfo.username,
      email: userInfo.email,
      role: refreshData.role,
      providerType: userInfo.providerType
    });

    return {
      success: true,
      accessToken: newAccessToken,
      userId: refreshData.id
    };
  } catch (error) {
    console.error('刷新 Access Token 失敗:', error);
    return {
      success: false,
      error: 'REFRESH_FAILED',
      message: '刷新 Token 失敗'
    };
  }
};

const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error('Token 解析失敗:', error);
    return null;
  }
};

const isTokenExpiringSoon = (token) => {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = decoded.exp;
    const thirtyMinutes = 30 * 60; 

    return (expirationTime - currentTime) < thirtyMinutes;
  } catch (error) {
    return true;
  }
};

const getErrorMessage = (error) => {
  switch (error.name) {
    case 'TokenExpiredError':
      return 'Token 已過期，請重新登入';
    case 'JsonWebTokenError':
      return 'Token 格式無效';
    case 'NotBeforeError':
      return 'Token 尚未生效';
    default:
      return 'Token 驗證失敗';
  }
};

export {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  refreshAccessToken,
  decodeToken,
  isTokenExpiringSoon,
  getErrorMessage,
};
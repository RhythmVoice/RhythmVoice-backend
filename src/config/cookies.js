import dotenv from 'dotenv';

dotenv.config();

// Cookie 名稱
const COOKIE_NAMES = {
  AUTH_TOKEN: 'auth_token',
  USER_DISPLAY: 'user_display', 
  CSRF_TOKEN: 'csrf_token',
  REMEMBER_ME: 'remember_me'
};

// 統一的 Cookie 配置
const cookieConfig = {
	// 主要認證 token（包含用戶 ID、角色等敏感資訊）
  auth_token: {
    httpOnly: true,                                   
    secure: process.env.NODE_ENV === 'production',     
    sameSite: 'strict',                               
    maxAge: 2 * 60 * 60 * 1000,                
    path: '/',                                        
    signed: true                                      
  },

  // 用戶顯示資訊（非敏感資料，供前端顯示使用）
  user_display: {
    httpOnly: false,                                  
    secure: process.env.NODE_ENV === 'production',     
    sameSite: 'strict',                                
    maxAge: 2 * 60 * 60 * 1000,                          
    path: '/',
    signed: false                                     
  },

  // CSRF Token
  csrf_token: {
    httpOnly: false,                                  
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,                      
    path: '/',
    signed: false
  },

  // 記住登入狀態
  remember_me: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,       
    path: '/',
    signed: true
  }
};

// 清除 Cookie 的配置（設定過期時間為過去）
const clearCookieConfig = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  expires: new Date(0)
};

export { 
  cookieConfig, 
  COOKIE_NAMES, 
  clearCookieConfig 
};
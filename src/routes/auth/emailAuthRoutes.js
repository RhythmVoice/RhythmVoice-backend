import express from 'express';
import { createValidationMiddleware } from '../../middlewares/auth/validationMiddleware.js';
import { signupSchema, loginSchema } from '../../validations/authValidation.js';
import { csrfProtection, conditionalCSRFProtection, refreshCSRFToken, provideCSRFToken, getCSRFStatus } from '../../middlewares/auth/csrfProtection.js';
// import { authMiddleware, optionalAuthMiddleware, requireRole, requireAdmin, requireModerator, getCurrentUser} from '../../middlewares/auth/authMiddleware.js';
import { signup, login } from '../../controllers/auth/emailAuthController.js';

const router = express.Router();

// 用戶註冊
router.post('/signup', createValidationMiddleware(signupSchema), signup);

// 用戶登入
router.post('/login', csrfProtection, createValidationMiddleware(loginSchema), login);

export default router;
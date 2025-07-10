import { z } from 'zod';

const signupSchema = z.object({
  username: z.string()
    .min(2, '姓名不可少於 2 個字元')
    .max(50, '姓名最多為 50 個字元')
    .regex(/^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/, '姓名只能包含中文、英文、數字、底線和連字號')
    .refine(val => val.trim().length > 0, '姓名不能只包含空白字元'),
  email: z.string()
    .email('Email 格式不正確'),
  password: z.string()
    .min(8, '密碼至少需要 8 個字元')
    .max(128, '密碼不可超過 128 個字元')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, '密碼必須包含至少 1 個大寫字母、小寫字母和數字'),
  birthday: z.union([
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '生日格式錯誤，請輸入 YYYY-MM-DD 格式')
      .refine((date) => {
        const birthDate = new Date(date);
        return !isNaN(birthDate.getTime());
      }, '請輸入有效的日期')
      .refine((date) => {
        const birthDate = new Date(date);
        const today = new Date();
        return birthDate <= today;
      }, '生日不能是未來日期'),
    z.undefined()
  ]),
  phoneNumber: z.string()
    .regex(/^09\d{8}$|^09\d{2}-\d{3}-\d{3}$/, '請輸入正確的手機號碼格式')
    .optional(),
});

const loginSchema = z.object({
  email: z.string()
    .min(1, 'Email 不能為空')
    .email('Email 格式不正確')
    .max(100, 'Email 長度不可超過 100 個字元'),
  password: z.string()
    .min(1, '密碼不能為空')
    .max(128, '密碼長度不可超過 128 個字元')
});

const forgotPasswordSchema = z.object({
  email: z.string()
    .min(1, 'Email 不能為空')
    .email('Email 格式不正確')
    .max(100, 'Email 長度不可超過 100 個字元')
});

export { 
  signupSchema, 
  loginSchema, 
  forgotPasswordSchema
};
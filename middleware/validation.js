// middleware/validation.js
const Joi = require('joi');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');

/**
 * Middleware عام للتحقق من صحة البيانات باستخدام Joi
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // إظهار جميع الأخطاء
      stripUnknown: true, // إزالة الحقول غير المعرفة
      convert: true // تحويل أنواع البيانات تلقائياً
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors
      });
    }

    // استبدال البيانات المدخلة بالبيانات المنظفة
    req[property] = value;
    next();
  };
};

/**
 * تنظيف البيانات من XSS و NoSQL Injection
 */
const sanitizeInput = (req, res, next) => {
  // تنظيف من NoSQL Injection
  mongoSanitize.sanitize(req.body);
  mongoSanitize.sanitize(req.query);
  mongoSanitize.sanitize(req.params);

  // تنظيف من XSS
  const cleanObject = (obj) => {
    if (typeof obj === 'string') {
      return xss(obj, {
        whiteList: {}, // لا نسمح بأي HTML tags
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script']
      });
    }
    
    if (Array.isArray(obj)) {
      return obj.map(cleanObject);
    }
    
    if (obj && typeof obj === 'object') {
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        cleaned[key] = cleanObject(value);
      }
      return cleaned;
    }
    
    return obj;
  };

  req.body = cleanObject(req.body);
  req.query = cleanObject(req.query);
  
  next();
};

/**
 * التحقق من حجم البيانات المرسلة
 */
const validateDataSize = (maxSize = '1mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      return res.status(413).json({
        success: false,
        message: `حجم البيانات كبير جداً. الحد الأقصى ${maxSize}`
      });
    }
    
    next();
  };
};

/**
 * تحويل حجم النص إلى bytes
 */
const parseSize = (size) => {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/);
  if (!match) return 1024 * 1024; // افتراضي 1MB
  
  const [, number, unit] = match;
  return parseFloat(number) * units[unit];
};

// ===== Validation Schemas =====

/**
 * تسجيل مستخدم جديد
 */
const registerSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(/^[\u0600-\u06FFa-zA-Z\s]+$/) // عربي وإنجليزي فقط
    .required()
    .messages({
      'string.empty': 'الاسم مطلوب',
      'string.min': 'الاسم يجب أن يكون حرفين على الأقل',
      'string.max': 'الاسم لا يجب أن يزيد عن 50 حرف',
      'string.pattern.base': 'الاسم يجب أن يحتوي على أحرف عربية أو إنجليزية فقط'
    }),

  email: Joi.string()
    .email()
    .trim()
    .lowercase()
    .max(100)
    .required()
    .messages({
      'string.email': 'صيغة البريد الإلكتروني غير صحيحة',
      'string.empty': 'البريد الإلكتروني مطلوب'
    }),

  phone: Joi.string()
    .trim()
    .pattern(/^(\+9677[0-9]{8}|\+9665[0-9]{8}|7[0-9]{8,9}|05[0-9]{8})$/)
    .required()
    .messages({
      'string.pattern.base': 'رقم الجوال يجب أن يكون يمني أو سعودي صحيح',
      'string.empty': 'رقم الجوال مطلوب'
    }),

  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
      'string.pattern.base': 'كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص',
      'string.empty': 'كلمة المرور مطلوبة'
    })
});

/**
 * تسجيل الدخول
 */
const loginSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'رقم الجوال مطلوب'
    }),

  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'كلمة المرور مطلوبة'
    }),

  role: Joi.string()
    .valid('user', 'admin')
    .optional()
});

/**
 * إضافة كلمة محظورة
 */
const bannedWordSchema = Joi.object({
  word: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'الكلمة المحظورة مطلوبة',
      'string.min': 'الكلمة يجب أن تكون حرف واحد على الأقل',
      'string.max': 'الكلمة لا يجب أن تزيد عن 100 حرف'
    }),

  type: Joi.string()
    .valid('contains', 'exact', 'starts', 'ends')
    .default('contains'),

  severity: Joi.string()
    .valid('low', 'medium', 'high')
    .default('medium'),

  action: Joi.string()
    .valid('delete', 'kick', 'warn', 'mute')
    .default('delete'),

  notes: Joi.string()
    .max(500)
    .optional()
    .allow('')
});

/**
 * تحديث الملف الشخصي
 */
const updateProfileSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(/^[\u0600-\u06FFa-zA-Z\s]+$/)
    .optional(),

  email: Joi.string()
    .email()
    .trim()
    .lowercase()
    .max(100)
    .optional()
});

/**
 * تغيير كلمة المرور
 */
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'string.empty': 'كلمة المرور الحالية مطلوبة'
    }),

  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل',
      'string.pattern.base': 'كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص',
      'string.empty': 'كلمة المرور الجديدة مطلوبة'
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'تأكيد كلمة المرور غير متطابق',
      'string.empty': 'تأكيد كلمة المرور مطلوب'
    })
});

module.exports = {
  validate,
  sanitizeInput,
  validateDataSize,
  schemas: {
    register: registerSchema,
    login: loginSchema,
    bannedWord: bannedWordSchema,
    updateProfile: updateProfileSchema,
    changePassword: changePasswordSchema
  }
};

// middleware/uploadInvoice.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// إنشاء مجلد الرفع إذا لم يكن موجوداً
const uploadDir = path.join(__dirname, '../uploads/invoices');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// إعداد التخزين
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // إنشاء اسم ملف فريد
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = `invoice-${req.user._id}-${uniqueSuffix}${ext}`;
    cb(null, name);
  }
});

// فلترة أنواع الملفات المسموحة
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/pdf'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم. يُسمح فقط بـ JPG, PNG, PDF'), false);
  }
};

// إعداد multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB حد أقصى
  }
});

// Middleware للتعامل مع أخطاء الرفع
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'عدد الملفات تجاوز الحد المسموح'
      });
    }
  }
  
  if (err.message.includes('نوع الملف غير مدعوم')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  return res.status(500).json({
    success: false,
    message: 'خطأ في رفع الملف'
  });
};

module.exports = {
  uploadSingle: upload.single('invoice'),
  handleUploadError
};

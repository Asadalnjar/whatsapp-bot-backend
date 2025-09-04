
//middeware/uploadSubscriptionProof.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 📌 تحديد مجلد التخزين
const uploadPath = path.join(__dirname, "../uploads/subscriptions");

// إنشاء المجلد إذا لم يكن موجود
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// 📌 إعداد تخزين الملفات
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // اسم الملف = userId + التاريخ + الامتداد
    const uniqueName = `${req.user._id}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// 📌 التحقق من نوع الملف
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("❌ نوع الملف غير مسموح، المسموح: صور أو PDF"));
  }
};

// 📌 إعداد الـ Multer
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter
});

module.exports = upload;

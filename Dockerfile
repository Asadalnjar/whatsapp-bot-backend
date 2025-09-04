# Dockerfile للـ Backend
FROM node:18-alpine

# إنشاء مجلد العمل
WORKDIR /app

# نسخ ملفات package
COPY package*.json ./

# تثبيت dependencies
RUN npm ci --only=production

# نسخ باقي الملفات
COPY . .

# إنشاء مجلد logs
RUN mkdir -p logs

# إنشاء مجلد uploads
RUN mkdir -p uploads/billing uploads/invoices uploads/subscriptions

# تعيين المنفذ
EXPOSE 5000

# متغيرات البيئة الافتراضية
ENV NODE_ENV=production
ENV PORT=5000

# تشغيل التطبيق
CMD ["npm", "start"]

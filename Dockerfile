# Dockerfile للـ Backend (Node 22 / إنتاج)
FROM node:22-alpine

# بيئة إنتاج مبكراً
ENV NODE_ENV=production
ENV PORT=5000

# مجلد العمل
WORKDIR /app

# نسخ ملفات التعريف أولاً للاستفادة من الكاش
COPY package*.json ./

# تثبيت تبعيات الإنتاج فقط (بديل --only=production)
RUN npm ci --omit=dev

# نسخ بقية السورس
COPY . .

# إنشاء مجلدات التشغيل
RUN mkdir -p logs \
    && mkdir -p uploads/billing uploads/invoices uploads/subscriptions

# مستخدم غير root لاعتبارات الأمان
RUN addgroup -S app && adduser -S app -G app \
    && chown -R app:app /app
USER app

# المنفذ
EXPOSE 5000

# التشغيل
CMD ["npm", "start"]

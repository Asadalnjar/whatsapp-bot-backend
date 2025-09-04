// ecosystem.config.js
// إعداد PM2 للاستضافة

module.exports = {
  apps: [
    {
      name: 'whatsapp-bot-backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      merge_logs: true,
      // إعادة التشغيل التلقائي عند تعطل
      min_uptime: '10s',
      max_restarts: 10,
      // مراقبة الذاكرة
      max_memory_restart: '500M',
      // متغيرات البيئة الإضافية
      env_vars: {
        NODE_OPTIONS: '--max-old-space-size=512'
      }
    }
  ],

  deploy: {
    production: {
      user: 'root',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:username/whatsapp-bot.git',
      path: '/var/www/whatsapp-bot',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};

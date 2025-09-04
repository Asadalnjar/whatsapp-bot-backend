// services/waSession.js
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

// نتأكد من مجلد الجلسات
const SESSIONS_DIR = path.join(__dirname, "../sessions");
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// نخزن كل جلسة بحسب userId
const sessions = new Map();

/**
 * يبدأ (أو يعيد استخدام) جلسة واتساب لمستخدم معيّن
 */
async function startSession(userId, socket) {
  // إذا فيه جلسة شغّالة لنفس المستخدم، اربط السوكِت الجديد وابعث حالته
  if (sessions.has(userId)) {
    const s = sessions.get(userId);
    s.socket = socket;
    // لو كان متصل فعلاً
    if (s.connected) socket.emit("wa:ready");
    else socket.emit("wa:waiting");
    return s.sock;
  }

  const authPath = path.join(SESSIONS_DIR, userId.toString());
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // ما نطبع في التيرمينال
    logger: pino({ level: "silent" }),
    browser: Browsers.ubuntu("Chrome")
  });

  const sessionRec = { sock, socket, connected: false };
  sessions.set(userId, sessionRec);

  // حفظ بيانات الاعتماد
  sock.ev.on("creds.update", saveCreds);

  // متابعة التغييرات (QR/اتصال/انقطاع)
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update || {};

    // لو وصل QR من واتساب: نحوله DataURL ونرسله للفرونت
    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        sessionRec.socket?.emit("wa:qr", { qr: qrDataUrl });
      } catch (e) {
        sessionRec.socket?.emit("wa:error", "فشل توليد صورة QR");
      }
    }

    if (connection === "open") {
      sessionRec.connected = true;
      sessionRec.socket?.emit("wa:ready"); // تم الربط بنجاح
    }

    if (connection === "close") {
      sessionRec.connected = false;
      sessionRec.socket?.emit("wa:disconnected");
    }
  });

  // استقبال أمر تسجيل الخروج من الفرونت
  socket.on("wa:logout", async () => {
    try {
      await sock?.logout();
      sessionRec.connected = false;
      socket.emit("wa:disconnected");
    } catch (e) {
      socket.emit("wa:error", "فشل تسجيل الخروج");
    }
  });

  // إعادة توليد/بدء الجلسة يدويًا
  socket.on("wa:restart", async () => {
    // يكفي إعادة إرسال QR لو متاح
    // (Baileys يرسل QR جديد تلقائيًا عند الحاجة)
    sessionRec.socket?.emit("wa:waiting");
  });

  return sock;
}

module.exports = { startSession };

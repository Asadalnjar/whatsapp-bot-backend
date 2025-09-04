// utils/text.js

// تحويل الأرقام العربية إلى إنجليزية والعكس غير مطلوب هنا، نكتفي بتوحيدها إلى الإنجليزية
function toLatinDigits(str = "") {
  const arabicZero = "٠".charCodeAt(0); // U+0660
  const easternZero = "۰".charCodeAt(0); // U+06F0
  let out = "";
  for (const ch of String(str)) {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) {
      out += String(code - arabicZero);
    } else if (code >= 0x06f0 && code <= 0x06f9) {
      out += String(code - easternZero);
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * تطبيع نص عربي:
 * - تخفيض حالة الأحرف
 * - إزالة التشكيل
 * - إزالة التطويل والكشف عن محارف مخفية
 * - توحيد آ/أ/إ -> ا ، ة -> ه ، ى -> ي
 * - تحويل الأرقام العربية إلى إنجليزية
 * - إزالة الرموز غير العربية/اللاتينية/الأرقام واستبدالها بمسافة
 * - ضغط المسافات
 */
function normalizeArabic(input = "") {
  let s = String(input);

  // محارف خفية/تحكم وزيرو-ويدث
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");

  // إلى أرقام لاتينية
  s = toLatinDigits(s);

  // إلى حروف صغيرة
  s = s.toLowerCase();

  // إزالة التشكيل
  s = s.replace(/[\u064B-\u0652]/g, "");

  // إزالة التطويل
  s = s.replace(/\u0640+/g, ""); // ـ

  // توحيد بعض الحروف
  s = s.replace(/[آأإ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

  // استبدال كل ما ليس عربي/لاتيني/أرقام/مسافة بمسافة
  s = s.replace(/[^\u0600-\u06FF0-9a-z\s]/gi, " ");

  // ضغط المسافات وتقليم
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/**
 * إنشاء نمط مطابق من كلمة/عبارة محظورة:
 * - إذا جاءت على شكل /pattern/ أو /^...$/ اعتبرها RegExp (آمن)
 * - إذا احتوت على * نحولها إلى RegExp وايلدكارد
 * - خلاف ذلك: substring أو كلمة كاملة حسب الوضع
 */
function compilePattern(raw, mode = "includes") {
  const original = String(raw || "");
  const source = normalizeArabic(original);
  if (!source) return null;

  // صيغة RegExp صريحة: /.../ أو /.../flags
  const regexLiteral = original.match(/^\/(.+)\/([a-z]*)$/i);
  if (regexLiteral) {
    try {
      const re = new RegExp(regexLiteral[1], regexLiteral[2] || "i");
      return {
        type: "regex",
        test: (txt) => re.test(txt),
      };
    } catch {
      // لو نمط خاطئ نتجاهله بأمان
      return null;
    }
  }

  // وايلدكارد بسيط: * => .*
  if (source.includes("*")) {
    const esc = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
    const re = mode === "word"
      ? new RegExp(`(^|\\s)${esc}($|\\s)`, "i")
      : new RegExp(esc, "i");
    return {
      type: "wildcard",
      test: (txt) => re.test(txt),
    };
  }

  // مطابقة كلمة كاملة (حدود تقريبية بمسافة/بداية/نهاية)
  if (mode === "word") {
    const re = new RegExp(`(^|\\s)${escapeRegex(source)}($|\\s)`, "i");
    return {
      type: "word",
      test: (txt) => re.test(txt),
    };
  }

  // مطابقة تحتوي (substring)
  return {
    type: "substr",
    test: (txt) => txt.includes(source),
  };
}

// هروب لسلاسل regex
function escapeRegex(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// كاش للأنماط المجمّعة لتسريع المطابقة
const _patternCache = new Map();
function getCompiled(raw, mode) {
  const key = `${mode}::${raw}`;
  if (_patternCache.has(key)) return _patternCache.get(key);
  const compiled = compilePattern(raw, mode);
  _patternCache.set(key, compiled);
  return compiled;
}

/**
 * مطابقة النص مع قائمة الكلمات/الأنماط المحظورة
 * @param {string[]} words  قائمة الكلمات/العبارات أو أنماط RegExp (بصيغة /.../)
 * @param {string}   text   النص المراد فحصه
 * @param {object}   opts   { mode: 'includes' | 'word' } (اختياري)
 * @returns {boolean}       true إذا وُجدت مطابقة
 *
 * أمثلة:
 * messageMatchesBanned(["قروب", "منع*رابط"], "هذا منع-رابط") => true (وايلدكارد)
 * messageMatchesBanned(["/\\b(?=.{0,10}رابط)\\b/"], "فيه رابط قريب") => true (RegExp)
 * messageMatchesBanned(["منع"], "المنع موجود", { mode: "word" }) => false
 */
function messageMatchesBanned(words = [], text = "", opts = {}) {
  const mode = (opts && opts.mode) || "includes"; // توافق خلفي
  const norm = normalizeArabic(text);

  for (const w of words || []) {
    const compiled = getCompiled(w, mode);
    if (!compiled) continue;
    if (compiled.test(norm)) return true;
  }
  return false;
}

module.exports = { normalizeArabic, messageMatchesBanned, toLatinDigits };

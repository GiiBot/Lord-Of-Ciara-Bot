module.exports = {
  /* ================== BOT ================== */
  BOT: {
    TIMEZONE: "Asia/Ho_Chi_Minh",
    SESSION_DURATION_MINUTES: 30, // thời gian mở điểm danh
    DM_DELAY_MS: 1200, // delay gửi DM tránh rate-limit
  },

  /* ================== CHANNEL ================== */
  CHANNEL: {
    ATTENDANCE_ID: process.env.CHANNEL_ID, // kênh điểm danh
    LOG_ID: process.env.LOG_CHANNEL_ID,     // kênh log
  },

  /* ================== ROLE ================== */
  ROLE: {
    TRUA: "Sự Kiện Trưa",
    TOI: "Sự Kiện Tối",
  },

  /* ================== SESSION TIME ================== */
  SESSION_TIME: {
    TRUA_START: 11, // 11h mở sự kiện trưa
    TOI_START: 17,  // 17h mở sự kiện tối
    END_HOUR: 23,   // sau 23h không mở ca
  },

  /* ================== EMBED ================== */
  EMBED: {
    COLOR: "#ff3333",
    FOOTER: "LORD OF CIARA • Attendance System",

    GIF: {
      TRUA: "https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif",
      TOI: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeW5kZHFpbzdwY2JwYWd0N2Rkdmx2c3dqa2o4bDVrYzJ6NXh2a2Q0MCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l0HlNQ03J5JxX6lva/giphy.gif",
    },
  },

  /* ================== BUTTON ================== */
  BUTTON: {
    LABEL: "🚨 Điểm Danh",
    STYLE: "Danger", // Primary | Secondary | Success | Danger
  },

  /* ================== REMIND MESSAGE ================== */
  REMIND: {
    CHANNEL_TEXT: (title) =>
      `🔔 **NHẮC ĐIỂM DANH – ${title}**`,

    DM_TEXT: (title, channelId) =>
      `🔔 **THÔNG BÁO ĐIỂM DANH SỰ KIỆN LORD OF CIARA – ${title}**\n\n` +
      `👉 Vui lòng vào room bên dưới để điểm danh:\n` +
      `<#${channelId}>\n\n` +
      `⏰ Điểm danh đang mở, đừng bỏ lỡ nhé!`,
  },

  /* ================== ADMIN ================== */
  ADMIN: {
    REQUIRE_ADMIN_PERMISSION: true, // chỉ Administrator
  },

  /* ================== FILE ================== */
  FILE: {
    DATA: "./data.json",
    LOG_DIR: "./logs",
  },
};

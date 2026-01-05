const { ButtonStyle } = require("discord.js");

module.exports = {
  /* ================== BOT ================== */
  BOT: {
    TIMEZONE: "Asia/Ho_Chi_Minh",
    AUTO_PIN: true,          // tự ghim bảng điểm danh
    COUNTDOWN_UPDATE: 60,    // cập nhật countdown (giây)
    REPLY_DELETE_AFTER: 15,  // thời gian tự gỡ reply (giây)
  },

  /* ================== CHANNEL ================== */
  CHANNEL: {
    ATTENDANCE_ID: process.env.CHANNEL_ID, // kênh điểm danh
    LOG_ID: process.env.LOG_CHANNEL_ID || null, // kênh log (nếu có)
  },

  /* ================== SESSION TIME ================== */
  // 🔥 LOGIC ĐÚNG THEO YÊU CẦU CỦA BẠN
  SESSION_TIME: {
    TRUA_START: 11, // 11:00
    TRUA_END: 16,   // 16:00 (4h chiều)

    TOI_START: 17,  // 17:00
    TOI_END: 22,    // 22:00 (10h tối)
  },

  /* ================== ROLE (CHỈ ĐÁNH DẤU) ================== */
  ROLE: {
    TRUA: "Sự Kiện Trưa",
    TOI: "Sự Kiện Tối",
  },

  /* ================== DATA ================== */
  FILE: {
    DATA: "./data.json", // lưu user đã điểm danh
  },

  /* ================== BUTTON ================== */
  BUTTON: {
    LABEL: "🚨 Điểm Danh",
    STYLE: ButtonStyle.Danger,
  },

  /* ================== EMBED ================== */
  EMBED: {
    COLOR: "#ff3333",
    FOOTER: "LORD OF CIARA • Attendance System",

    GIF: {
      TRUA: "https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif",
      TOI: "https://media.giphy.com/media/l0HlNQ03J5JxX6lva/giphy.gif",
    },

    REPLY_GIF: {
      SUCCESS: "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif",
      ERROR: "https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif",
      CLOSED: "https://media.giphy.com/media/l3vR85PnGsBwu1PFK/giphy.gif",
    },
  },

  /* ================== REMIND ================== */
  REMIND: {
    DM_DELAY: 1200, // delay giữa mỗi DM (ms)
    MESSAGE: (sessionName, channelId, countdownText) =>
      `🔔 **NHẮC ĐIỂM DANH – ${sessionName}**\n\n👉 Vào kênh <#${channelId}> để điểm danh.\n${countdownText}`,
  },
};

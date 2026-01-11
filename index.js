require("dotenv").config();
const fs = require("fs");
const cron = require("node-cron");
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

/* ================== CONFIG ================== */


const CONFIG = {
  TIMEZONE: "Asia/Ho_Chi_Minh",
  CHANNEL_ID: process.env.CHANNEL_ID,
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
  DATA_FILE: "./data.json",
  DM_DELAY: 1200,

  SESSION_TIME: {
    TRUA_START: 11,
    TRUA_END: 16,
    TOI_START: 17,
    TOI_END: 22,
  },

  EMBED: {
    COLOR: "#ff3333",
    FOOTER: "LORD OF CIARA • TOP NHỮNG NGƯỜI CHỊU ĐAU GIỎI NHẤT RPV",
    GIF_TRUA: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnZzd251dGI1Y2ozamxzbXRweXBhNmpxNnk1dm5zc25mbmNrenhqZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/jzHFPlw89eTqU/giphy.gif",
    GIF_TOI: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnZzd251dGI1Y2ozamxzbXRweXBhNmpxNnk1dm5zc25mbmNrenhqZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/LLsUNd14gwSkSLYTcR/giphy.gif",
  },

  BUTTON: {
    LABEL: "🚨 Điểm Danh",
    STYLE: ButtonStyle.Danger,
  },
};

const REPLY_GIF = {
  SUCCESS: "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3eGdkamtzc3JpOGlsamd3ZGUzbmN1dnZvcjRweDJ5c3liY3ZxcHptNiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/kJKiGH3pwDpIFekymA/giphy.gif",
  ERROR: "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbTM5Y3h6eXM4aHhtbDdxZjdpNXZla284bXplZWcxc2RmaWN4ZWU0dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/VUhn4clMyitnG/giphy.gif",
  CLOSED: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExejBpeml6NTJlbWY3b2k5dHBrb3Y5MzAxMGozdWdkNTFwenNodng1NyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/k63gNYkfIxbwY/giphy.gif",
};

/* ================== CLIENT ================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/* ================== STATE ================== */
let attendanceMessageId = null;
let currentSession = null;
let sessionEndTime = null;
let countdownInterval = null;

/* ================== TIME ================== */
function getVNTime() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: CONFIG.TIMEZONE })
  );
}
function getWeekRange() {
  const now = getVNTime();
  const day = now.getDay(); // CN = 0

  // CN 11:00
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(11, 0, 0, 0);

  // Nếu hiện tại < CN 11:00 → lùi về tuần trước
  if (now < start) {
    start.setDate(start.getDate() - 7);
  }

  // T7 20:00
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(20, 0, 0, 0);

  return { start, end };
}


function getCurrentSession() {
  const h = getVNTime().getHours();
  if (h >= CONFIG.SESSION_TIME.TRUA_START && h < CONFIG.SESSION_TIME.TRUA_END)
    return "trua";
  if (h >= CONFIG.SESSION_TIME.TOI_START && h < CONFIG.SESSION_TIME.TOI_END)
    return "toi";
  return null;
}

function getSessionEndTime(session) {
  const now = getVNTime();
  const end = new Date(now);

  if (session === "trua") {
    end.setHours(CONFIG.SESSION_TIME.TRUA_END, 0, 0, 0);
  }

  if (session === "toi") {
    end.setHours(CONFIG.SESSION_TIME.TOI_END, 0, 0, 0);
  }

  // nếu đã quá giờ đóng → đóng luôn
  if (end.getTime() <= now.getTime()) {
    return now.getTime();
  }

  return end.getTime();
}
/* ================== DATA ================== */
function loadData() {
  if (!fs.existsSync(CONFIG.DATA_FILE)) {
    fs.writeFileSync(
      CONFIG.DATA_FILE,
      JSON.stringify({ users: [], records: [] }, null, 2)
    );
  }

  const data = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE));
  if (!data.users) data.users = [];
  if (!data.records) data.records = [];
  return data;
}

function saveData(data) {
  fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(data, null, 2));
}

/* ================== COUNTDOWN ================== */
function getCountdownText() {
  if (!sessionEndTime) return "";

  const now = getVNTime().getTime();
  const diff = sessionEndTime - now;

  if (diff <= 0) return "⛔ **Điểm danh đã đóng**";

  const totalMin = Math.ceil(diff / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  return h > 0
    ? `⏳ **Còn ${h}h ${m}p sẽ đóng**`
    : `⏳ **Còn ${m}p sẽ đóng**`;
}


/* ================== EMBED ================== */
function buildBoardEmbed(data) {
  const list =
    data.users.length === 0
      ? "_Chưa có ai điểm danh_"
      : data.users.map((id, i) => `${i + 1}. <@${id}>`).join("\n");

  const isTrua = currentSession === "trua";

  return new EmbedBuilder()
    .setTitle(`📌 ${isTrua ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI"}`)
    .setColor(CONFIG.EMBED.COLOR)
    .setDescription(
      `🔥 **Điểm danh đang mở**\n` +
        `👥 **Đã điểm danh:** ${data.users.length}\n` +
        `${getCountdownText()}\n\n${list}`
    )
    .setImage(isTrua ? CONFIG.EMBED.GIF_TRUA : CONFIG.EMBED.GIF_TOI)
    .setFooter({ text: CONFIG.EMBED.FOOTER })
    .setTimestamp();
}

/* ================== AUTO LOG ================== */
async function autoSendLog() {
  if (!CONFIG.LOG_CHANNEL_ID) return;

  const logChannel = await client.channels.fetch(CONFIG.LOG_CHANNEL_ID);
  if (!logChannel) return;

  const data = loadData();

  const list =
    data.users.length === 0
      ? "_Không có ai điểm danh_"
      : data.users.map((id, i) => `${i + 1}. <@${id}>`).join("\n");

  const embed = new EmbedBuilder()
    .setTitle(
      `📋 LOG ĐIỂM DANH – ${
        currentSession === "trua" ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI"
      }`
    )
    .setColor("#00ff99")
    .setDescription(
      `👥 **Tổng:** ${data.users.length}\n\n${list}`
    )
    .setFooter({ text: CONFIG.EMBED.FOOTER })
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
}

/* ================== WEEKLY STATS ================== */

async function sendWeeklyStats() {
  if (!CONFIG.LOG_CHANNEL_ID) return;

  const logChannel = await client.channels.fetch(CONFIG.LOG_CHANNEL_ID);
  if (!logChannel) return;

  const data = loadData();
  const { start, end } = getWeekRange(); // CN 11:00 → T7 20:00

  const counter = {};

  // Đếm số buổi SK mỗi người tham gia trong tuần
  for (const r of data.records) {
    const t = new Date(r.time);
    if (t >= start && t <= end) {
      counter[r.userId] = (counter[r.userId] || 0) + 1;
    }
  }

  // Chuyển sang mảng + sort giảm dần
  const entries = Object.entries(counter).sort((a, b) => b[1] - a[1]);

  const list =
    entries.length === 0
      ? "_Không có ai tham gia sự kiện trong tuần_"
      : entries
          .map(
            ([userId, count], index) =>
              `${index + 1}. <@${userId}> — **${count} buổi SK**`
          )
          .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("📊 BẢNG TỔNG THAM GIA SỰ KIỆN TUẦN")
    .setColor("#ffaa00")
    .setDescription(
      `🗓️ **Thời gian:**\n` +
      `• Bắt đầu: ${start.toLocaleString("vi-VN")}\n` +
      `• Kết thúc: ${end.toLocaleString("vi-VN")}\n\n` +
      `👥 **Tổng người tham gia:** ${entries.length}\n\n` +
      list
    )
    .setFooter({ text: CONFIG.EMBED.FOOTER })
    .setTimestamp();

 await logChannel.send({ embeds: [embed] });

  // 🧹 RESET RECORDS SAU KHI CHỐT TUẦN
 data.records = [];
 saveData(data);

 console.log("🧹 Đã reset records sau thống kê tuần");

}



/* ================== REPLY 15s ================== */
async function replyEmbedCountdown(interaction, opt) {
  let t = 15;
  const build = () =>
    new EmbedBuilder()
      .setColor(opt.color)
      .setTitle(opt.title)
      .setDescription(`${opt.text}\n\n⏳ **Tự gỡ sau ${t}s**`)
      .setImage(opt.gif)
      .setFooter({ text: CONFIG.EMBED.FOOTER });

  await interaction.reply({ embeds: [build()], ephemeral: true });

  const i = setInterval(async () => {
    t--;
    if (t <= 0) {
      clearInterval(i);
      interaction.deleteReply().catch(() => {});
      return;
    }
    await interaction.editReply({ embeds: [build()] }).catch(() => {});
  }, 1000);
}

/* ================== OPEN SESSION ================== */
async function openSession() {
  const session = getCurrentSession();
  if (!session) return;

  currentSession = session;
  sessionEndTime = getSessionEndTime(session);
  const data = loadData();
  data.users = [];
  saveData(data);


  const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);

  const msg = await channel.send({
    content: "@everyone 🚨 **ĐÃ MỞ ĐIỂM DANH!**",
    embeds: [buildBoardEmbed({ users: [] })],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("diemdanh")
          .setLabel(CONFIG.BUTTON.LABEL)
          .setStyle(CONFIG.BUTTON.STYLE)
      ),
    ],
  });

  attendanceMessageId = msg.id;
  await msg.pin().catch(() => {});
}

/* ================== RESEND ================== */
async function resendBoard() {
  const session = getCurrentSession();
  if (!session) return;

  currentSession = session;
  sessionEndTime = getSessionEndTime(session);

  const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
  const data = loadData();

  const msg = await channel.send({
    content: "🔁 **GỬI LẠI BẢNG ĐIỂM DANH**",
    embeds: [buildBoardEmbed(data)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("diemdanh")
          .setLabel(CONFIG.BUTTON.LABEL)
          .setStyle(CONFIG.BUTTON.STYLE)
      ),
    ],
  });

  attendanceMessageId = msg.id;
  await msg.pin().catch(() => {});
}

/* ================== BUTTON ================== */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== "diemdanh") return;

  if (!sessionEndTime || Date.now() > sessionEndTime) {
    return replyEmbedCountdown(interaction, {
      title: "⛔ ĐIỂM DANH ĐÃ ĐÓNG",
      text: "Sự kiện đã kết thúc.",
      gif: REPLY_GIF.CLOSED,
      color: "#999999",
    });
  }

  const data = loadData();
  if (data.users.includes(interaction.user.id)) {
    return replyEmbedCountdown(interaction, {
      title: "❌ ĐÃ ĐIỂM DANH",
      text: "Bạn đã điểm danh rồi!",
      gif: REPLY_GIF.ERROR,
      color: "#ff4444",
    });
  }

  data.users.push(interaction.user.id);
  data.records.push({
    userId: interaction.user.id,
    time: new Date().toISOString(),
    session: currentSession,
  });
  saveData(data);
  const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
  const msg = await channel.messages.fetch(attendanceMessageId);
  await msg.edit({ embeds: [buildBoardEmbed(data)] });

  return replyEmbedCountdown(interaction, {
    title: "✅ĐÃ ĐIỂM DANH THÀNH CÔNG",
    text: "Chúc mừng bạn còn chịu đau tốt 🔥",
    gif: REPLY_GIF.SUCCESS,
    color: "#4CAF50",
  });
});

/* ================== ADMIN ================== */
client.on("messageCreate", async (message) => {
  if (
    message.author.bot ||
    !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
  )
    return;

  if (message.content === "!resend") resendBoard();

  if (message.content === "!remind dm") {
    const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
    for (const m of channel.guild.members.cache.values()) {
      if (m.user.bot) continue;
      try {
        await m.send(
          `🔔 **NHẮC ĐIỂM DANH – ${
            currentSession === "trua" ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI"
          }**\n👉 Nhấn vào kênh <#${CONFIG.CHANNEL_ID}> để điểm danh tham gia sự kiện cùng homiee`
        );
      } catch {}
      await new Promise((r) => setTimeout(r, CONFIG.DM_DELAY));
    }
    channel.send("📩 **Đã gửi DM nhắc điểm danh**");
  }

  if (message.content === "!log") {
    const data = loadData();
    const list =
      data.users.length === 0
        ? "_Không có ai điểm danh_"
        : data.users.map((id, i) => `${i + 1}. <@${id}>`).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("📋 LOG ĐIỂM DANH")
      .setColor("#00ff99")
      .setDescription(`👥 **Tổng:** ${data.users.length}\n\n${list}`)
      .setFooter({ text: CONFIG.EMBED.FOOTER });

    message.reply({ embeds: [embed] });
  }
});

/* ================== CRON ================== */
// 🔒 Đóng phiên cuối tuần 8 h tối 
cron.schedule(
  "0 20 * * 6",
  sendWeeklyStats,
  { timezone: CONFIG.TIMEZONE }
);

// 🔒 Đóng phiên TRƯA + gửi log vào kênh LOG (16:00)
cron.schedule(
  "0 16 * * *",
  async () => {
    currentSession = "trua";
    await autoSendLog();                 // log
    await announceCloseSession("trua");  // 🔔 THÔNG BÁO HẾT GIỜ
    currentSession = null;
    sessionEndTime = null;
    attendanceMessageId = null;
    console.log("📋 Đã đóng phiên TRƯA");
  },
  { timezone: CONFIG.TIMEZONE }
);



// 🔒 Đóng phiên TỐI + gửi log vào kênh LOG (22:00)
cron.schedule(
  "0 22 * * *",
  async () => {
    currentSession = "toi";
    await autoSendLog();                 // log
    await announceCloseSession("toi");   // 🔔 THÔNG BÁO HẾT GIỜ
    currentSession = null;
    sessionEndTime = null;
    attendanceMessageId = null;
    console.log("📋 Đã đóng phiên TỐI");
  },
  { timezone: CONFIG.TIMEZONE }
);

async function announceCloseSession(session) {
  const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("⛔ SỰ KIỆN ĐÃ KẾT THÚC")
    .setColor("#999999")
    .setDescription(
      session === "trua"
        ? "🕓 **Sự kiện TRƯA đã đóng (16:00)**"
        : "🌙 **Sự kiện TỐI đã đóng (22:00)**"
    )
    .setFooter({ text: CONFIG.EMBED.FOOTER })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

// 🟢 MỞ PHIÊN TRƯA (11:00)
cron.schedule(
  "0 11 * * *",
  openSession,
  { timezone: CONFIG.TIMEZONE }
);

// 🟢 MỞ PHIÊN TỐI (17:00)
cron.schedule(
  "0 17 * * *",
  openSession,
  { timezone: CONFIG.TIMEZONE }
);


/* ================== READY ================== */
client.once("ready", () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  console.log(`🏠 Server: ${client.guilds.cache.size}`);
});
/* ================== LOGIN ================== */
client.login(process.env.TOKEN);

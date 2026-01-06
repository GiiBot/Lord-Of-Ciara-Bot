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
const { startAutoNotify } = require("./autoNotify");

// trong client.once("ready")
client.once("ready", () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  startAutoNotify(client);
});

const CONFIG = {
  TIMEZONE: "Asia/Ho_Chi_Minh",
  CHANNEL_ID: process.env.CHANNEL_ID,
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
    fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify({ users: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(CONFIG.DATA_FILE));
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
  saveData({ users: [] });

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
cron.schedule("0 11 * * *", openSession, { timezone: CONFIG.TIMEZONE });
cron.schedule("0 17 * * *", openSession, { timezone: CONFIG.TIMEZONE });

/* ================== READY ================== */
client.once("ready", () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
});

/* ================== LOGIN ================== */
client.login(process.env.TOKEN);

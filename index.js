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
    FOOTER: "LORD OF CIARA • Attendance System",
    GIF_TRUA: "https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif",
    GIF_TOI: "https://media.giphy.com/media/l0HlNQ03J5JxX6lva/giphy.gif",
  },

  BUTTON: {
    LABEL: "🚨 Điểm Danh",
    STYLE: ButtonStyle.Danger,
  },
};

const REPLY_GIF = {
  SUCCESS: "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif",
  ERROR: "https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif",
  CLOSED: "https://media.giphy.com/media/l3vR85PnGsBwu1PFK/giphy.gif",
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
let currentSession = null; // "trua" | "toi"
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

  if (session === "trua")
    end.setHours(CONFIG.SESSION_TIME.TRUA_END, 0, 0, 0);
  else
    end.setHours(CONFIG.SESSION_TIME.TOI_END, 0, 0, 0);

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

/* ================== COUNTDOWN TEXT ================== */
function getCountdownText() {
  if (!sessionEndTime) return "";
  const diff = sessionEndTime - Date.now();
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

/* ================== REPLY COUNTDOWN 15s ================== */
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

  const timer = setInterval(async () => {
    t--;
    if (t <= 0) {
      clearInterval(timer);
      interaction.deleteReply().catch(() => {});
      return;
    }
    await interaction.editReply({ embeds: [build()] }).catch(() => {});
  }, 1000);
}

/* ================== DISABLE OLD BOARD ================== */
async function disableOldBoard(channel) {
  if (!attendanceMessageId) return;
  try {
    const msg = await channel.messages.fetch(attendanceMessageId);
    await msg.edit({
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("disabled")
            .setLabel("⛔ Bảng đã làm mới")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        ),
      ],
    });
  } catch {}
}

/* ================== COUNTDOWN UPDATE ================== */
function startCountdown(channel) {
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(async () => {
    try {
      const msg = await channel.messages.fetch(attendanceMessageId);
      const data = loadData();
      await msg.edit({ embeds: [buildBoardEmbed(data)] });
    } catch {
      clearInterval(countdownInterval);
    }
  }, 60 * 1000);
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
  startCountdown(channel);
}

/* ================== RESEND ================== */
async function resendBoard() {
  if (!currentSession) return;

  const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
  await disableOldBoard(channel);

  const data = loadData();
  const msg = await channel.send({
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
  startCountdown(channel);
}

/* ================== REMIND DM ================== */
async function remindDM() {
  if (!currentSession) return;

  const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
  const guild = channel.guild;

  let ok = 0;
  let fail = 0;

  for (const m of guild.members.cache.values()) {
    if (m.user.bot) continue;

    try {
      let t = 15;

      const build = () =>
        new EmbedBuilder()
          .setColor("#ff9900")
          .setTitle("🔔 NHẮC ĐIỂM DANH")
          .setDescription(
            `📌 **${
              currentSession === "trua"
                ? "SỰ KIỆN TRƯA"
                : "SỰ KIỆN TỐI"
            }**\n\n👉 Vào kênh <#${CONFIG.CHANNEL_ID}> để điểm danh\n${getCountdownText()}\n\n⏳ **Tự gỡ sau ${t}s**`
          )
          .setImage(
            currentSession === "trua"
              ? CONFIG.EMBED.GIF_TRUA
              : CONFIG.EMBED.GIF_TOI
          )
          .setFooter({ text: CONFIG.EMBED.FOOTER });

      const dm = await m.send({ embeds: [build()] });

      const timer = setInterval(async () => {
        t--;
        if (t <= 0) {
          clearInterval(timer);
          dm.delete().catch(() => {});
          return;
        }
        await dm.edit({ embeds: [build()] }).catch(() => {});
      }, 1000);

      ok++;
    } catch {
      fail++;
    }

    await new Promise((r) => setTimeout(r, CONFIG.DM_DELAY));
  }

  await channel.send(`📩 Nhắc DM xong | ✅ ${ok} | ❌ ${fail}`);
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
    title: "✅ ĐIỂM DANH THÀNH CÔNG",
    text: "Chúc bạn chơi vui 🔥",
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
  if (message.content === "!remind dm") remindDM();
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

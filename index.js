require("dotenv").config();
const fs = require("fs");
const cron = require("node-cron");
const config = require("./config");
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

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
let attendanceMessageId = null; // bảng active
let currentRoleName = null;     // ca hiện tại
let sessionEndTime = null;      // thời điểm đóng theo sự kiện
let countdownInterval = null;

/* ================== GIF REPLY ================== */
const REPLY_GIF = {
  SUCCESS: "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif",
  ERROR: "https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif",
  CLOSED: "https://media.giphy.com/media/l3vR85PnGsBwu1PFK/giphy.gif",
};

/* ================== TIME ================== */
function getVNTime() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: config.BOT.TIMEZONE })
  );
}

function getCurrentSessionVN() {
  const h = getVNTime().getHours();
  if (h >= config.SESSION_TIME.TRUA_START && h < config.SESSION_TIME.TOI_START)
    return "trua";
  if (h >= config.SESSION_TIME.TOI_START && h < config.SESSION_TIME.END_HOUR)
    return "toi";
  return null;
}

function getSessionEndTimeByEvent(session) {
  const now = getVNTime();
  const end = new Date(now);
  if (session === "trua") {
    end.setHours(config.SESSION_TIME.TOI_START, 0, 0, 0);
  } else {
    end.setHours(config.SESSION_TIME.END_HOUR, 0, 0, 0);
  }
  return end.getTime();
}

/* ================== DATA ================== */
function loadData() {
  if (!fs.existsSync(config.FILE.DATA)) {
    fs.writeFileSync(config.FILE.DATA, JSON.stringify({ users: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(config.FILE.DATA));
}

function saveData(data) {
  fs.writeFileSync(config.FILE.DATA, JSON.stringify(data, null, 2));
}

/* ================== REPLY EMBED + COUNTDOWN ================== */
async function replyEmbedCountdown(interaction, options) {
  let time = 15;

  const build = () =>
    new EmbedBuilder()
      .setColor(options.color)
      .setTitle(options.title)
      .setDescription(`${options.text}\n\n⏳ **Tự đóng sau ${time}s**`)
      .setImage(options.gif)
      .setFooter({ text: config.EMBED.FOOTER });

  await interaction.reply({
    embeds: [build()],
    ephemeral: true,
  });

  const interval = setInterval(async () => {
    time--;
    if (time <= 0) {
      clearInterval(interval);
      interaction.deleteReply().catch(() => {});
      return;
    }
    await interaction.editReply({ embeds: [build()] }).catch(() => {});
  }, 1000);
}

/* ================== EMBED BẢNG ================== */
function getCountdownText() {
  if (!sessionEndTime) return "";
  const diff = sessionEndTime - Date.now();
  if (diff <= 0) return "⛔ **Điểm danh đã đóng**";

  const totalMinutes = Math.ceil(diff / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return h > 0
    ? `⏳ **Còn ${h}h ${m}p sẽ đóng**`
    : `⏳ **Còn ${m}p sẽ đóng**`;
}

function buildEmbed(data, title, isTrua) {
  const list =
    data.users.length === 0
      ? "_Chưa có ai điểm danh_"
      : data.users.map((id, i) => `${i + 1}. <@${id}>`).join("\n");

  return new EmbedBuilder()
    .setTitle(`📌 ${title}`)
    .setColor(config.EMBED.COLOR)
    .setDescription(
      `🔥 **Điểm danh đang mở**\n` +
      `👥 **Đã điểm danh:** ${data.users.length}\n` +
      `${getCountdownText()}\n\n${list}`
    )
    .setImage(isTrua ? config.EMBED.GIF.TRUA : config.EMBED.GIF.TOI)
    .setFooter({ text: config.EMBED.FOOTER })
    .setTimestamp();
}

/* ================== DISABLE BẢNG CŨ ================== */
async function disableOldAttendanceButton(channel) {
  if (!attendanceMessageId) return;
  try {
    const oldMsg = await channel.messages.fetch(attendanceMessageId);
    await oldMsg.edit({
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

/* ================== COUNTDOWN REALTIME ================== */
function startCountdownUpdater(channel, isTrua) {
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(async () => {
    if (!attendanceMessageId) return;
    try {
      const msg = await channel.messages.fetch(attendanceMessageId);
      const data = loadData();
      await msg.edit({
        embeds: [
          buildEmbed(
            data,
            isTrua ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI",
            isTrua
          ),
        ],
      });
    } catch {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }, 60 * 1000);
}

/* ================== OPEN SESSION (AUTO) ================== */
async function openSession() {
  const session = getCurrentSessionVN();
  if (!session) return;

  const channel = await client.channels.fetch(config.CHANNEL.ATTENDANCE_ID);
  const isTrua = session === "trua";

  currentRoleName = isTrua ? config.ROLE.TRUA : config.ROLE.TOI;
  sessionEndTime = getSessionEndTimeByEvent(session);
  saveData({ users: [] });

  const msg = await channel.send({
    content: "@everyone 🚨 **ĐÃ MỞ ĐIỂM DANH!**",
    embeds: [buildEmbed({ users: [] }, isTrua ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI", isTrua)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("diemdanh")
          .setLabel(config.BUTTON.LABEL)
          .setStyle(ButtonStyle[config.BUTTON.STYLE])
      ),
    ],
  });

  attendanceMessageId = msg.id;
  await msg.pin().catch(() => {});
  startCountdownUpdater(channel, isTrua);
}

/* ================== RESEND (ADMIN) ================== */
async function resendAttendanceBoard() {
  const channel = await client.channels.fetch(config.CHANNEL.ATTENDANCE_ID);
  const data = loadData();
  if (!currentRoleName) return;

  const isTrua = currentRoleName === config.ROLE.TRUA;
  await disableOldAttendanceButton(channel);

  const msg = await channel.send({
    embeds: [buildEmbed(data, isTrua ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI", isTrua)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("diemdanh")
          .setLabel(config.BUTTON.LABEL)
          .setStyle(ButtonStyle[config.BUTTON.STYLE])
      ),
    ],
  });

  attendanceMessageId = msg.id;
  await msg.pin().catch(() => {});
  startCountdownUpdater(channel, isTrua);
}

/* ================== BUTTON ================== */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== "diemdanh") return;

  if (!sessionEndTime || Date.now() > sessionEndTime) {
    return replyEmbedCountdown(interaction, {
      title: "⛔ ĐIỂM DANH ĐÃ ĐÓNG",
      text: "Sự kiện này đã kết thúc.",
      gif: REPLY_GIF.CLOSED,
      color: "#999999",
    });
  }

  const data = loadData();
  if (data.users.includes(interaction.user.id)) {
    return replyEmbedCountdown(interaction, {
      title: "❌ ĐÃ ĐIỂM DANH",
      text: "Bạn đã điểm danh trong khung giờ này rồi!",
      gif: REPLY_GIF.ERROR,
      color: "#ff4444",
    });
  }

  data.users.push(interaction.user.id);
  saveData(data);

  const channel = interaction.channel;
  const isTrua = currentRoleName === config.ROLE.TRUA;
  const msg = await channel.messages.fetch(attendanceMessageId);
  await msg.edit({
    embeds: [
      buildEmbed(
        data,
        isTrua ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI",
        isTrua
      ),
    ],
  });

  return replyEmbedCountdown(interaction, {
    title: "✅ ĐIỂM DANH THÀNH CÔNG",
    text: "Chúc bạn chơi vui và cháy hết mình 🔥",
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

  if (message.content === "!resend") {
    await resendAttendanceBoard();
  }
});

/* ================== CRON ================== */
cron.schedule("0 11 * * *", openSession, { timezone: config.BOT.TIMEZONE });
cron.schedule("0 17 * * *", openSession, { timezone: config.BOT.TIMEZONE });

/* ================== READY ================== */
client.once("ready", () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
});

/* ================== LOGIN ================== */
client.login(process.env.TOKEN);

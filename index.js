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
} = require("discord.js");

/* ================== CLIENT ================== */
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/* ================== AUTO DELETE + COUNTDOWN ================== */
async function replyAutoDeleteWithCountdown(interaction, options, seconds = 5) {
  let timeLeft = seconds;

  const buildRow = (t) =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("countdown")
        .setLabel(`⏳ Tự gỡ sau ${t}s`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

  await interaction.deferReply({ ephemeral: true });
  await interaction.editReply({
    ...options,
    components: [buildRow(timeLeft)],
  });

  const interval = setInterval(async () => {
    timeLeft--;

    if (timeLeft <= 0) {
      clearInterval(interval);
      interaction.deleteReply().catch(() => {});
      return;
    }

    await interaction
      .editReply({
        ...options,
        components: [buildRow(timeLeft)],
      })
      .catch(() => {});
  }, 1000);
}

/* ================== DATA ================== */
const DATA_FILE = "./data.json";
let attendanceMessageId = null;

function today() {
  return new Date().toLocaleDateString("vi-VN");
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ date: today(), users: [] }, null, 2)
    );
  }
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ================== EMBEDS ================== */

// Embed danh sách điểm danh (CÔNG KHAI)
function buildAttendanceEmbed(data) {
  const list =
    data.users.length === 0
      ? "_Chưa có ai điểm danh_"
      : data.users
          .slice(0, 20)
          .map((id, i) => `${i + 1}. <@${id}>`)
          .join("\n") +
        (data.users.length > 20
          ? `\n…và ${data.users.length - 20} người khác`
          : "");

  return new EmbedBuilder()
    .setTitle("📌 ĐIỂM DANH")
    .setColor("#00ff99")
    .setDescription(
      "**Nhấn nút bên dưới để điểm danh!**\n\n" +
        "• Mỗi người chỉ điểm danh 1 lần\n\n" +
        `👥 **Đã điểm danh:** ${data.users.length} người\n\n` +
        "🏆 **Danh sách điểm danh**\n" +
        list
    )
    .setImage("https://media.giphy.com/media/26n6WywJyh39n1pBu/giphy.gif")
    .setFooter({ text: "LORD OF CIARA • Attendance System" })
    .setTimestamp();
}

// Thành công
function successEmbed(user, stt) {
  return new EmbedBuilder()
    .setColor("#4CAF50")
    .setTitle("✅ ĐIỂM DANH THÀNH CÔNG")
    .setDescription(
      `👤 **${user.username}**\n` +
        `🔢 **Số thứ tự của bạn:** ${stt}\n\n` +
        "⏰ *Hãy vào room sớm 30 phút trước khi bắt đầu sự kiện!*"
    )
    .setImage("https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif")
    .setTimestamp();
}

// Lỗi
function errorEmbed(text) {
  return new EmbedBuilder()
    .setColor("#ff4d4d")
    .setTitle("❌ KHÔNG THỂ ĐIỂM DANH")
    .setDescription(text)
    .setImage("https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif")
    .setTimestamp();
}

/* ================== READY ================== */
client.once("ready", async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);

  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  const data = loadData();

  if (data.date !== today()) {
    data.date = today();
    data.users = [];
    saveData(data);
  }

  const msg = await channel.send({
    embeds: [buildAttendanceEmbed(data)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("diemdanh")
          .setLabel("Điểm Danh")
          .setStyle(ButtonStyle.Primary)
      ),
    ],
  });

  attendanceMessageId = msg.id;
});

/* ================== BUTTON ================== */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "diemdanh") return;

  const data = loadData();

  if (data.date !== today()) {
    data.date = today();
    data.users = [];
  }

  //

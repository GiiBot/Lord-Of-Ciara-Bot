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
async function replyAutoDelete(interaction, options, time = 5000) {
  await interaction.deferReply({ ephemeral: true });
  await interaction.editReply(options);

  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, time);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

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

/* ================== EMBED BUILDERS ================== */

// Embed danh sách điểm danh (công khai)
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
        "**Lưu ý:**\n" +
        "• Mỗi người chỉ điểm danh 1 lần\n\n" +
        `👥 **Đã điểm danh:** ${data.users.length} người\n\n` +
        "🏆 **Danh sách điểm danh**\n" +
        list
    )
    .setImage(
      "https://media.giphy.com/media/26n6WywJyh39n1pBu/giphy.gif"
    )
    .setFooter({ text: "LORD OF CIARA • Attendance System" })
    .setTimestamp();
}

// Embed trả về khi điểm danh thành công (RIÊNG)
function successEmbed(user, stt) {
  return new EmbedBuilder()
    .setColor("#4CAF50")
    .setTitle("✅ ĐIỂM DANH THÀNH CÔNG")
    .setDescription(
      `👤 **${user.username}**\n` +
      `🔢 **Số thứ tự của bạn:** ${stt}\n\n` +
      "⏰ *Hãy vào room sớm 30 phút trước khi bắt đầu sự kiện!*"
    )
    .setImage(
      "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif"
    )
    .setFooter({ text: "Chúc bạn chơi vui 🔥" })
    .setTimestamp();
}

// Embed lỗi (đã điểm danh)
function errorEmbed(text) {
  return new EmbedBuilder()
    .setColor("#ff4d4d")
    .setTitle("❌ KHÔNG THỂ ĐIỂM DANH")
    .setDescription(text)
    .setImage(
      "https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif"
    )
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

  const embed = buildAttendanceEmbed(data);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("diemdanh")
      .setLabel("Điểm Danh")
      .setStyle(ButtonStyle.Primary)
  );

  const msg = await channel.send({
    embeds: [embed],
    components: [row],
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

  // check role (nếu có)
  if (process.env.ROLE_ID) {
    if (!interaction.member.roles.cache.has(process.env.ROLE_ID)) {
      return interaction.reply({
        embeds: [errorEmbed("Bạn không có quyền điểm danh!")],
        ephemeral: true,
      });
    }
  }

  // đã điểm danh
  if (data.users.includes(interaction.user.id)) {
    return interaction.reply({
      embeds: [errorEmbed("Bạn đã điểm danh hôm nay rồi!")],
      ephemeral: true,
    });
  }

  // thêm user
  data.users.push(interaction.user.id);
  saveData(data);

  // cập nhật embed công khai
  const channel = interaction.channel;
  const msg = await channel.messages.fetch(attendanceMessageId);
  await msg.edit({ embeds: [buildAttendanceEmbed(data)] });

  // trả embed riêng đẹp + gif
  const stt = data.users.length;
  await interaction.reply({
    embeds: [successEmbed(interaction.user, stt)],
    ephemeral: true,
  });
});

/* ================== RESET 00:00 ================== */
cron.schedule("0 0 * * *", () => {
  saveData({ date: today(), users: [] });
  console.log("🔄 Reset điểm danh mỗi ngày");
});

/* ================== LOGIN ================== */
client.login(process.env.TOKEN);

require("dotenv").config();
const fs = require("fs");
const path = require("path");
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

/* ================== CLIENT ================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/* ================== CONFIG ================== */
const ROLE_TRUA = "Sự Kiện Trưa";
const ROLE_TOI = "Sự Kiện Tối";
const DATA_FILE = "./data.json";
let attendanceMessageId = null;
let currentRoleName = null;

/* ================== TIME ================== */
function today() {
  return new Date().toLocaleDateString("vi-VN");
}

/* ================== DATA ================== */
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

/* ================== LOG ================== */
function writeLog(text) {
  const logsDir = "./logs";
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

  const date = new Date();
  const fileName = `attendance-${date.toISOString().slice(0, 10)}.log`;
  const filePath = path.join(logsDir, fileName);

  const time = date.toLocaleTimeString("vi-VN");
  fs.appendFileSync(filePath, `[${time}] ${text}\n`);
}

async function uploadTodayLog(note = "") {
  if (!process.env.LOG_CHANNEL_ID) return;

  try {
    const logChannel = await client.channels.fetch(
      process.env.LOG_CHANNEL_ID
    );
    const date = new Date().toISOString().slice(0, 10);
    const filePath = `./logs/attendance-${date}.log`;
    if (!fs.existsSync(filePath)) return;

    await logChannel.send({
      content:
        `📄 **LOG ĐIỂM DANH ${date}**` +
        (note ? `\n📝 ${note}` : ""),
      files: [filePath],
    });
  } catch (e) {
    console.error("Upload log lỗi:", e.message);
  }
}

/* ================== AUTO DELETE + COUNTDOWN ================== */
async function replyAutoDeleteWithCountdown(interaction, embeds, seconds = 15) {
  let t = seconds;

  const row = (x) =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("countdown")
        .setLabel(`⏳ Tự gỡ sau ${x}s`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

  await interaction.deferReply({ ephemeral: true });
  await interaction.editReply({ embeds, components: [row(t)] });

  const i = setInterval(async () => {
    t--;
    if (t <= 0) {
      clearInterval(i);
      interaction.deleteReply().catch(() => {});
      return;
    }
    await interaction
      .editReply({ embeds, components: [row(t)] })
      .catch(() => {});
  }, 1000);
}

/* ================== ROLE ================== */
async function getOrCreateRole(guild, name) {
  let role = guild.roles.cache.find((r) => r.name === name);
  if (!role) {
    role = await guild.roles.create({
      name,
      color: "Blue",
      permissions: [],
      hoist: false,
      mentionable: false,
      reason: "Role đánh dấu điểm danh",
    });
  }
  return role;
}

async function removeRoleFromAll(guild, name) {
  const role = guild.roles.cache.find((r) => r.name === name);
  if (!role) return;
  for (const m of role.members.values()) {
    await m.roles.remove(role).catch(() => {});
  }
}

/* ================== EMBEDS ================== */
function buildAttendanceEmbed(data, title) {
  const list =
    data.users.length === 0
      ? "_Chưa có ai điểm danh_"
      : data.users.map((id, i) => `${i + 1}. <@${id}>`).join("\n");

  return new EmbedBuilder()
    .setTitle(`📌 ${title}`)
    .setColor("#00ff99")
    .setDescription(
      `👥 **Đã điểm danh:** ${data.users.length} người\n\n${list}`
    )
    .setImage("https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExeTVzMDZsMzUzaXppdmdzeWViOHU4NHN5MWY3a205dm5icW5zMGVoMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ispEc1253326c/giphy.gif")
    .setFooter({ text: "LORD OF CIARA - Sự kiện • Top những người chịu đau tốt nhất thế giới" })
    .setTimestamp();
}

function successEmbed(user, role) {
  return new EmbedBuilder()
    .setColor("#4CAF50")
    .setTitle("✅ ĐIỂM DANH THÀNH CÔNG")
    .setDescription(`👤 ${user.username}\n🎭 **${role}**`)
    .setImage("https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif");
}

function errorEmbed(text) {
  return new EmbedBuilder()
    .setColor("#ff4d4d")
    .setTitle("❌ KHÔNG THỂ ĐIỂM DANH")
    .setDescription(text)
    .setImage("https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExaWIzdHk2cnRmaTBnN2lkZmJ2cnpoOW1yenYwdDlvbjh5MW1zNmZ2dSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/7SF5scGB2AFrgsXP63/giphy.gif");
}

/* ================== OPEN SESSION ================== */
async function openSession(type, byAdmin = false) {
  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  const guild = channel.guild;

  const isTrua = type === "sang";
  const roleName = isTrua ? ROLE_TRUA : ROLE_TOI;
  const oldRole = isTrua ? ROLE_TOI : ROLE_TRUA;
  const title = isTrua ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI";

  currentRoleName = roleName;
  saveData({ date: today(), users: [] });

  await removeRoleFromAll(guild, oldRole);
  await getOrCreateRole(guild, roleName);

  await channel.send({ content: "@everyone ⏰ **Đã mở điểm danh!**" });

  const msg = await channel.send({
    embeds: [buildAttendanceEmbed(loadData(), title)],
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
  writeLog(`MỞ CA: ${title}`);
  await uploadTodayLog(byAdmin ? "Admin resend" : "Tự động");
}

/* ================== CRON ================== */
cron.schedule("0 11 * * *", () => openSession("sang"));
cron.schedule("0 17 * * *", () => openSession("chieu"));

/* ================== BUTTON ================== */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "diemdanh") return;

  const data = loadData();
  if (data.users.includes(interaction.user.id)) {
    writeLog(`TỪ CHỐI | ${interaction.user.tag}`);
    return replyAutoDeleteWithCountdown(
      interaction,
      [errorEmbed("Bạn đã điểm danh sự kiện này rồi!")],
      15
    );
  }

  data.users.push(interaction.user.id);
  saveData(data);
  writeLog(`ĐIỂM DANH | ${interaction.user.tag} | ${currentRoleName}`);

  const role = interaction.guild.roles.cache.find(
    (r) => r.name === currentRoleName
  );
  if (role) await interaction.member.roles.add(role).catch(() => {});

  const msg = await interaction.channel.messages.fetch(attendanceMessageId);
  await msg.edit({
    embeds: [buildAttendanceEmbed(data, currentRoleName)],
  });

  await replyAutoDeleteWithCountdown(
    interaction,
    [successEmbed(interaction.user, currentRoleName)],
    15
  );
});

/* ================== ADMIN COMMAND ================== */
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (
    !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
  )
    return;

  if (message.content === "!resend sang") openSession("sang", true);
  if (message.content === "!resend chieu") openSession("chieu", true);
});

/* ================== READY ================== */
client.once("ready", () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
});

/* ================== LOGIN ================== */
client.login(process.env.TOKEN);

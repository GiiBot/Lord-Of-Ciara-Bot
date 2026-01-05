require("dotenv").config();
const fs = require("fs");
const path = require("path");
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
let attendanceMessageId = null;
let currentRoleName = null;
let sessionEndTime = null;
let sessionCloseTimeout = null;

/* ================== TIME ================== */
function getVNTime() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: config.BOT.TIMEZONE })
  );
}
function todayKey() {
  return getVNTime().toISOString().slice(0, 10);
}
function getCurrentSessionVN() {
  const h = getVNTime().getHours();
  if (h >= config.SESSION_TIME.TRUA_START && h < config.SESSION_TIME.TOI_START)
    return "trua";
  if (h >= config.SESSION_TIME.TOI_START && h < config.SESSION_TIME.END_HOUR)
    return "toi";
  return null;
}

/* ================== DATA ================== */
function loadJSON(file, def) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(def, null, 2));
  return JSON.parse(fs.readFileSync(file));
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* ================== LOG ================== */
function writeLog(text) {
  if (!fs.existsSync(config.FILE.LOG_DIR))
    fs.mkdirSync(config.FILE.LOG_DIR);

  const file = `attendance-${todayKey()}.log`;
  fs.appendFileSync(
    path.join(config.FILE.LOG_DIR, file),
    `[${getVNTime().toLocaleTimeString("vi-VN")}] ${text}\n`
  );
}

/* ================== SEND LIST LOG ================== */
async function sendAttendanceListLog(title) {
  if (!config.CHANNEL.LOG_ID) return;
  const logChannel = await client.channels.fetch(config.CHANNEL.LOG_ID);
  const data = loadJSON(config.FILE.DATA, { users: [] });

  if (data.users.length === 0) {
    await logChannel.send(`📋 **${title}**\n❌ Không có ai điểm danh.`);
    return;
  }

  const lines = data.users.map((id, i) => {
    const m = logChannel.guild.members.cache.get(id);
    return `${i + 1}. ${m ? m.displayName : id}`;
  });

  await logChannel.send(
    `📋 **DANH SÁCH ĐIỂM DANH – ${title}**\n👥 **Tổng:** ${
      data.users.length
    }\n\n${lines.join("\n")}`.slice(0, 1900)
  );
}

/* ================== ROLE ================== */
async function getOrCreateRole(guild, name) {
  let role = guild.roles.cache.find((r) => r.name === name);
  if (!role) {
    role = await guild.roles.create({
      name,
      permissions: [],
      hoist: false,
      mentionable: false,
    });
  }
  return role;
}
async function removeRoleFromAll(guild, name) {
  const role = guild.roles.cache.find((r) => r.name === name);
  if (!role) return;
  for (const m of role.members.values())
    await m.roles.remove(role).catch(() => {});
}

/* ================== EMBED ================== */
function buildEmbed(data, title, isTrua) {
  const minutesLeft = Math.max(
    0,
    Math.ceil((sessionEndTime - Date.now()) / 60000)
  );

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
        `⏳ **Còn ${minutesLeft} phút sẽ đóng**\n\n${list}`
    )
    .setImage(isTrua ? config.EMBED.GIF.TRUA : config.EMBED.GIF.TOI)
    .setFooter({ text: config.EMBED.FOOTER })
    .setTimestamp();
}

/* ================== SESSION ================== */
async function openSession(byAdmin = false) {
  const session = getCurrentSessionVN();
  if (!session) return;

  if (byAdmin && currentRoleName) {
    await sendAttendanceListLog(
      currentRoleName === config.ROLE.TRUA
        ? "SỰ KIỆN TRƯA"
        : "SỰ KIỆN TỐI"
    );
  }

  if (sessionCloseTimeout) clearTimeout(sessionCloseTimeout);

  const channel = await client.channels.fetch(config.CHANNEL.ATTENDANCE_ID);
  const guild = channel.guild;

  const isTrua = session === "trua";
  const roleName = isTrua ? config.ROLE.TRUA : config.ROLE.TOI;
  const oldRole = isTrua ? config.ROLE.TOI : config.ROLE.TRUA;
  const title = isTrua ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI";

  currentRoleName = roleName;
  sessionEndTime =
    Date.now() + config.BOT.SESSION_DURATION_MINUTES * 60000;

  saveJSON(config.FILE.DATA, { users: [] });

  await removeRoleFromAll(guild, oldRole);
  await getOrCreateRole(guild, roleName);

  await channel.send({ content: "@everyone 🚨 **ĐÃ MỞ ĐIỂM DANH!**" });

  const msg = await channel.send({
    embeds: [buildEmbed({ users: [] }, title, isTrua)],
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
  writeLog(`MỞ CA: ${title}`);

  sessionCloseTimeout = setTimeout(
    async () => await sendAttendanceListLog(title),
    config.BOT.SESSION_DURATION_MINUTES * 60000
  );
}

/* ================== CRON ================== */
cron.schedule("0 11 * * *", openSession, {
  timezone: config.BOT.TIMEZONE,
});
cron.schedule("0 17 * * *", openSession, {
  timezone: config.BOT.TIMEZONE,
});

/* ================== BUTTON ================== */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== "diemdanh") return;

  if (!sessionEndTime || Date.now() > sessionEndTime) {
    return interaction.reply({ content: "⛔ Điểm danh đã đóng!", ephemeral: true });
  }

  const data = loadJSON(config.FILE.DATA, { users: [] });
  if (data.users.includes(interaction.user.id)) {
    return interaction.reply({ content: "❌ Bạn đã điểm danh rồi!", ephemeral: true });
  }

  data.users.push(interaction.user.id);
  saveJSON(config.FILE.DATA, data);
  writeLog(`ĐIỂM DANH | ${interaction.user.tag}`);

  const role = interaction.guild.roles.cache.find(
    (r) => r.name === currentRoleName
  );
  if (role) await interaction.member.roles.add(role).catch(() => {});

  const msg = await interaction.channel.messages.fetch(attendanceMessageId);
  await msg.edit({
    embeds: [
      buildEmbed(
        data,
        currentRoleName === config.ROLE.TRUA
          ? "SỰ KIỆN TRƯA"
          : "SỰ KIỆN TỐI",
        currentRoleName === config.ROLE.TRUA
      ),
    ],
  });

  await interaction.reply({ content: "✅ Điểm danh thành công!", ephemeral: true });
});

/* ================== ADMIN ================== */
client.on("messageCreate", async (message) => {
  if (
    message.author.bot ||
    !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
  )
    return;

  if (message.content === "!resend") openSession(true);
});

/* ================== READY ================== */
client.once("ready", () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
});

/* ================== LOGIN ================== */
client.login(process.env.TOKEN);

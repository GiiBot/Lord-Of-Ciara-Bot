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
const SESSION_DURATION_MINUTES = 30;

let attendanceMessageId = null;
let currentRoleName = null;
let sessionEndTime = null;
let sessionCloseTimeout = null;

/* ================== TIME ================== */
function getVNTime() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
}
function todayKey() {
  return getVNTime().toISOString().slice(0, 10);
}
function getCurrentSessionVN() {
  const h = getVNTime().getHours();
  if (h >= 11 && h < 17) return "trua";
  if (h >= 17 && h < 23) return "toi";
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
  const logsDir = "./logs";
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
  const file = `attendance-${todayKey()}.log`;
  fs.appendFileSync(
    path.join(logsDir, file),
    `[${getVNTime().toLocaleTimeString("vi-VN")}] ${text}\n`
  );
}

/* ================== LOG LIST ================== */
async function sendAttendanceListLog(title) {
  if (!process.env.LOG_CHANNEL_ID) return;
  const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);
  const data = loadJSON(DATA_FILE, { users: [] });

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

/* ================== FILTER NOT CHECKED ================== */
function getMembersNotCheckedIn(guild) {
  const data = loadJSON(DATA_FILE, { users: [] });
  const checked = new Set(data.users);
  const role = guild.roles.cache.find((r) => r.name === currentRoleName);

  return guild.members.cache.filter(
    (m) =>
      !m.user.bot &&
      !checked.has(m.id) &&
      (!role || !m.roles.cache.has(role.id))
  );
}

/* ================== EMBED ================== */
function buildEmbed(data, title) {
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
    .setColor("#ff3333")
    .setDescription(
      `🔥 **Điểm danh sự kiện đang mở**\n` +
        `👥 **Đã điểm danh:** ${data.users.length}\n` +
        `⏳ **Còn ${minutesLeft} phút sẽ đóng**\n\n${list}`
    )
    .setImage(
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExa3B2aTZmOWRocnV1Y2c2b3p4eXN5dWNqMG5rNjF5dmp6aDRkMGV6ZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3ohzdIuqJoo8QdKlnW/giphy.gif"
    )
    .setFooter({ text: "LORD OF CIARA • Attendance System" })
    .setTimestamp();
}

/* ================== SESSION ================== */
async function openSession(byAdmin = false) {
  const session = getCurrentSessionVN();
  if (!session) return;

  if (byAdmin && currentRoleName) {
    await sendAttendanceListLog(
      currentRoleName === ROLE_TRUA ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI"
    );
  }

  if (sessionCloseTimeout) clearTimeout(sessionCloseTimeout);

  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  const guild = channel.guild;

  const isTrua = session === "trua";
  const roleName = isTrua ? ROLE_TRUA : ROLE_TOI;
  const oldRole = isTrua ? ROLE_TOI : ROLE_TRUA;
  const title = isTrua ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI";

  currentRoleName = roleName;
  sessionEndTime = Date.now() + SESSION_DURATION_MINUTES * 60000;
  saveJSON(DATA_FILE, { users: [] });

  await removeRoleFromAll(guild, oldRole);
  await getOrCreateRole(guild, roleName);

  await channel.send({ content: "@everyone 🚨 **ĐÃ MỞ ĐIỂM DANH!**" });

  const msg = await channel.send({
    embeds: [buildEmbed(loadJSON(DATA_FILE, { users: [] }), title)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("diemdanh")
          .setLabel("🚨 Điểm Danh")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  });

  attendanceMessageId = msg.id;
  writeLog(`MỞ CA: ${title}`);

  sessionCloseTimeout = setTimeout(async () => {
    await sendAttendanceListLog(title);
  }, SESSION_DURATION_MINUTES * 60 * 1000);
}

/* ================== CRON ================== */
cron.schedule("0 11 * * *", openSession, { timezone: "Asia/Ho_Chi_Minh" });
cron.schedule("0 17 * * *", openSession, { timezone: "Asia/Ho_Chi_Minh" });

/* ================== BUTTON ================== */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== "diemdanh") return;

  if (!sessionEndTime || Date.now() > sessionEndTime) {
    return interaction.reply({ content: "⛔ Điểm danh đã đóng!", ephemeral: true });
  }

  const data = loadJSON(DATA_FILE, { users: [] });
  if (data.users.includes(interaction.user.id)) {
    return interaction.reply({ content: "❌ Bạn đã điểm danh rồi!", ephemeral: true });
  }

  data.users.push(interaction.user.id);
  saveJSON(DATA_FILE, data);
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
        currentRoleName === ROLE_TRUA ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI"
      ),
    ],
  });

  await interaction.reply({ content: "✅ Điểm danh thành công!", ephemeral: true });
});

/* ================== REMIND ================== */
async function remindChannel(all = false) {
  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  const members = getMembersNotCheckedIn(channel.guild).map((m) => `<@${m.id}>`);
  if (members.length === 0) {
    await channel.send("✅ Tất cả đã điểm danh!");
    return;
  }

  const title =
    currentRoleName === ROLE_TRUA ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI";

  const chunk = 20;
  for (let i = 0; i < members.length; i += chunk) {
    await channel.send(
      `🔔 **NHẮC ĐIỂM DANH – ${title}**\n` +
        members.slice(i, i + chunk).join(" ")
    );
    if (!all) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
}

async function remindDM() {
  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  const members = getMembersNotCheckedIn(channel.guild);

  let ok = 0,
    fail = 0;
  for (const m of members.values()) {
    try {
      await m.send(
        `🔔 **NHẮC ĐIỂM DANH – ${
          currentRoleName === ROLE_TRUA ? "SỰ KIỆN TRƯA" : "SỰ KIỆN TỐI"
        }**\n👉 Vào kênh <#${process.env.CHANNEL_ID}> để điểm danh nhé!`
      );
      ok++;
    } catch {
      fail++;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  await channel.send(`📩 Nhắc DM xong | ✅ ${ok} | ❌ ${fail}`);
}

/* ================== ADMIN ================== */
client.on("messageCreate", async (message) => {
  if (
    message.author.bot ||
    !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
  )
    return;

  if (message.content === "!resend") openSession(true);
  if (message.content === "!remind") remindChannel(false);
  if (message.content === "!remind all") remindChannel(true);
  if (message.content === "!remind dm") remindDM();
});

/* ================== READY ================== */
client.once("ready", () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
});

/* ================== LOGIN ================== */
client.login(process.env.TOKEN);

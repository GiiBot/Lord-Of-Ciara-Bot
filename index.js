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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const DATA_FILE = "./data.json";

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function today() {
  return new Date().toLocaleDateString("vi-VN");
}

client.once("ready", async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);

  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  const data = loadData();

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

  const msg = await channel.send({
    embeds: [embed],
    components: [row],
  });

  attendanceMessageId = msg.id;
});


  await channel.send({ embeds: [embed], components: [row] });
});

// xử lý điểm danh
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "diemdanh") return;

  const data = loadData();

  if (data.date !== today()) {
    data.date = today();
    data.users = [];
  }

  if (process.env.ROLE_ID) {
    if (!interaction.member.roles.cache.has(process.env.ROLE_ID)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền điểm danh!",
        ephemeral: true,
      });
    }
  }

  if (!interaction.member.voice.channel) {
    return interaction.reply({
      content: "❌ Bạn phải ở trong voice channel!",
      ephemeral: true,
    });
  }

  if (data.users.includes(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Bạn đã điểm danh hôm nay rồi!",
      ephemeral: true,
    });
  }

  data.users.push(interaction.user.id);
  saveData(data);
  // số thứ tự
const stt = data.users.length;

await interaction.reply({
  content:
    `📌 **Số thứ tự của bạn: ${stt}**\n` +
    `• Hãy vào room **sớm 30 phút** trước khi bắt đầu sự kiện.`,
  ephemeral: true
});

  await interaction.reply({
    content: `✅ ${interaction.user} đã điểm danh!\n👥 Tổng: **${data.users.length}** người`,
  });
});

// reset mỗi ngày 00:00
cron.schedule("0 0 * * *", () => {
  saveData({ date: today(), users: [] });
  console.log("🔄 Reset điểm danh");
});

client.login(process.env.TOKEN);

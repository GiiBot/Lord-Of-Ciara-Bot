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
let attendanceMessageId = null; // bảng active
let currentRoleName = null;     // ca hiện tại
let sessionEndTime = null;      // thời điểm đóng theo sự kiện
let countdownInterval = null;

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

/* ================== EMBED ================== */
function getCountdownText() {
  if (!sessionEndTime) return "";
  const diff = sessionEndTime - Date.now();
  if (diff <= 0) return "⛔ **Điểm danh đã đóng**";

  const to

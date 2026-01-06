const fs = require("fs");

const ANNOUNCE_CHANNEL_ID = "ID_KENH_THONG_BAO";
const START_HOUR = 8;
const END_HOUR = 23;
const INTERVAL = 60 * 60 * 1000;

let enabled = true;

function getVNTime() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function startAutoNotify(client) {
  console.log("🔔 Auto Notify module loaded");

  // Thông báo mỗi 1 tiếng
  setInterval(() => {
    if (!enabled) return;

    const now = getVNTime();
    const hour = now.getHours();
    if (hour < START_HOUR || hour >= END_HOUR) return;

    const channel = client.channels.cache.get(ANNOUNCE_CHANNEL_ID);
    if (!channel) return;

    const data = JSON.parse(fs.readFileSync("./messages.json"));
    const msg = randomItem(data.hourly);

    channel.send({
      embeds: [{
        title: "🔔 THÔNG BÁO TỰ ĐỘNG",
        description: msg,
        color: 0xff9900,
        footer: { text: "Hệ thống tự động • Không ping" },
        timestamp: new Date()
      }]
    });
  }, INTERVAL);

  // Thông báo cuối ngày (23:00)
  setInterval(() => {
    if (!enabled) return;

    const now = getVNTime();
    if (now.getHours() !== 23 || now.getMinutes() !== 0) return;

    const channel = client.channels.cache.get(ANNOUNCE_CHANNEL_ID);
    if (!channel) return;

    const data = JSON.parse(fs.readFileSync("./messages.json"));

    channel.send({
      embeds: [{
        title: "📆 THÔNG BÁO CUỐI NGÀY",
        description: data.endOfDay,
        color: 0x00ccff,
        timestamp: new Date()
      }]
    });
  }, 60 * 1000);
}

// Cho command điều khiển
function setAutoNotify(state) {
  enabled = state;
}

function getAutoNotify() {
  return enabled;
}

module.exports = {
  startAutoNotify,
  setAutoNotify,
  getAutoNotify
};

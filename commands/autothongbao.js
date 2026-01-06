const { setAutoNotify, getAutoNotify } = require("../autoNotify");

module.exports = {
  name: "autothongbao",
  description: "Bật / tắt thông báo tự động",

  options: [
    {
      name: "trangthai",
      description: "Bật hoặc tắt hệ thống",
      type: 3, // STRING
      required: true,
      choices: [
        { name: "BẬT", value: "on" },
        { name: "TẮT", value: "off" }
      ]
    }
  ],

  async execute(interaction) {
    const state = interaction.options.getString("trangthai");

    setAutoNotify(state === "on");

    return interaction.reply({
      content:
        state === "on"
          ? "✅ Đã **BẬT** hệ thống thông báo tự động"
          : "⛔ Đã **TẮT** hệ thống thông báo tự động",
      ephemeral: true
    });
  }
};

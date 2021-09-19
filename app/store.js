const Store = require("electron-store");

const configStore = new Store({
  name: "config",
  defaults: {
    notification: {
      lostarkID: "",
      lostarkPW: "",
      discordUserID: "",
      repeat: false,
      interval: 1,
    },
  },
});

const itemStore = new Store({
  name: "item",
  defaults: {
    notification: [],
  },
});

const logStore = new Store({
  name: "log",
  defaults: {
    notification: [],
  },
});

console.log("store import");

module.exports = {
  configStore,
  itemStore,
  logStore,
};

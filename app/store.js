const Store = require("electron-store");

const configStore = new Store({
  name: "config",
  accessPropertiesByDotNotation: false,
  defaults: {
    notification: {
      lostarkID: "",
      lostarkPW: "",
      discordUserID: "",
      repeat: false,
      interval: 1,
      saveLogs: false,
    },
  },
});

const itemStore = new Store({
  name: "item",
  accessPropertiesByDotNotation: false,
  defaults: {
    notification: [],
  },
});

const logStore = new Store({
  name: "log",
  accessPropertiesByDotNotation: false,
  defaults: {
    notification: [],
  },
});

console.log("store import", configStore.path);

module.exports = {
  configStore,
  itemStore,
  logStore,
};

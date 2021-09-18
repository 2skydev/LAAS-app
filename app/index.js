const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { search, initBrowser } = require("./notification");
const moment = require("moment");

let page = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1800,
    height: 1000,
    backgroundColor: "#36393F",
    darkTheme: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: __dirname + "/preload.js",
    },
  });

  if (process.env.NODE_ENV === "dev") {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  } else {
    win.loadFile(`${path.join(__dirname, "../www/index.html")}`);
  }

  win.on("ready-to-show", () => {
    win.show();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on("initBrowser", async (event, { setting }) => {
  page = await initBrowser(setting);
  event.reply("initBrowser-success");
});

ipcMain.on("notification", async (event, { items, setting }) => {
  if (page) {
    const logs = await search(page, items, setting);
    event.reply("notification-logs", logs);
  } else {
    event.reply("notification-logs", [
      {
        id: performance.now() + Math.random(),
        status: "noInitBrowser",
        time: moment().format("HH:mm:ss"),
        desc: "브라우저가 초기화되지 않음",
      },
    ]);
  }
});

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { search, initBrowser } = require("./notification");
const moment = require("moment");
const { createLog } = require("./util");
const { configStore, itemStore, logStore } = require("./store");

let win = null;
let page = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1800,
    height: 1000,
    backgroundColor: "#36393F",
    darkTheme: true,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      nativeWindowOpen: false,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.env.NODE_ENV === "dev") {
    win.loadURL("http://localhost:3000");
    // win.webContents.openDevTools();
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

// 모든 창이 닫길 때 앱 끄기
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// 창 닫기, 최대화, 최소화 같은 컨트롤 기능
ipcMain.on("appControl", async (e, action) => {
  switch (action) {
    case "minimize": {
      win.minimize();
      break;
    }

    case "maximize": {
      win.isMaximized() ? win.unmaximize() : win.maximize();
      break;
    }

    case "close": {
      win.close();
      break;
    }
  }
});

// 크롤링 브라우저 생성
ipcMain.handle("initBrowser", async (e, { setting }) => {
  if (page) {
    return false;
  }

  page = await initBrowser(setting);

  if (!page) {
    createLog({
      status: "login-fail",
      desc: "로스트아크 로그인에 실패하였습니다.\n아이디 비밀번호를 확인해주세요.",
    });

    return false;
  }

  return true;
});

// 매물 검색 알림 요청
ipcMain.on("notification", async (e, { items, setting }) => {
  createLog(await search(page, items, setting));
});

ipcMain.handle("getConfig", (e, key) => {
  return configStore.get(key);
});

ipcMain.handle("setConfig", (e, key, data) => {
  return configStore.set(key, data);
});

ipcMain.handle("getItems", (e) => {
  return itemStore.get("notification");
});

ipcMain.handle("setItems", (e, data) => {
  return itemStore.set("notification", data);
});

ipcMain.handle("getLogs", (e, key) => {
  return logStore.get("notification");
});

logStore.onDidChange("notification", () => {
  ipcMain.send("logs", logStore.get("notification"));
});

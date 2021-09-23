const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { configStore, itemStore, logStore } = require("./store");
const { search, initBrowser } = require("./notification");
const { createLog } = require("./util");

let win = null;
let timeoutHandle = null;
global.page = null;

const createWindow = () => {
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
    win.webContents.openDevTools();
  } else {
    win.loadFile(`${path.join(__dirname, "../www/index.html")}`);
  }

  win.on("ready-to-show", () => {
    win.show();
  });
};

const searchInterval = async () => {
  const setting = configStore.get("notification");

  await search();

  timeoutHandle = setTimeout(searchInterval, 1000 * 60 * setting.interval);
};

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
ipcMain.handle("initBrowser", async () => {
  if (global.page) {
    return false;
  }

  const setting = configStore.get("notification");

  global.page = await initBrowser(setting);

  if (!global.page) {
    createLog({
      status: "loginFail",
      desc: "로스트아크 로그인에 실패하였습니다.\n아이디 비밀번호를 확인해주세요.",
    });

    return false;
  }

  return true;
});

// 로그 데이터가 변경되었을 때 변경되었다는 이벤트 생성
logStore.onDidChange("notification", (_, logs) => {
  ipcMain.send("logs", logs);
});

// 설정이 변경되었을 때 필수 값들을 확인 후 매물 검색 실행
configStore.onDidChange("notification", async () => {
  if (!page || !setting.discordUserID) {
    clearTimeout(timeoutHandle);
    return;
  }

  searchInterval();
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

ipcMain.handle("getLogs", () => {
  return logStore.get("notification");
});

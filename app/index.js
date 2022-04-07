const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  nativeImage,
  Menu,
} = require("electron");
const path = require("path");

// %USERPROFILE%\AppData\Local\Programs\laas
// %USERPROFILE%\AppData\Roaming\laas

const { configStore, itemStore, logStore } = require("./store");
const { search, initBrowser } = require("./notification");
const { changeStatus } = require("./util");

let timeoutHandle = null;
let intervalHandle = null;
let sec = 0;
let isSearcing = false;
let tray = null;
global.win = null;
global.page = null;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  return false;
}

const createWindow = () => {
  if (global.win) {
    if (global.win.isMinimized()) global.win.restore();
    global.win.focus();
    return;
  }

  global.win = new BrowserWindow({
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
    // global.win.loadURL("http://localhost:3000");
    global.win.loadFile(`${path.join(__dirname, "../www/index.html")}`);
    // global.win.webContents.openDevTools();
  } else {
    global.win.loadFile(`${path.join(__dirname, "../www/index.html")}`);
  }

  global.win.on("ready-to-show", () => {
    global.win.show();
  });
};

const searchInterval = async () => {
  if (isSearcing) {
    return;
  }

  clearTimeout(timeoutHandle);
  clearInterval(intervalHandle);

  const setting = configStore.get("notification");
  const items = itemStore.get("notification");

  if (!page || !setting.discordUserID) {
    changeStatus("error", "configError", "필수 설정값이 비어있습니다");
    return;
  }

  if (!items.length) {
    changeStatus(
      "warning",
      "configError",
      "매물 알림 관리에서 검색할 매물을 등록해주세요 :)"
    );
    return;
  }

  isSearcing = true;

  changeStatus("processing", "searchStart", "매물 검색 시작");

  await search();

  sec = setting.interval * 60;
  changeStatus("success", "nextSearchSec", `다음 검색까지 ${sec}초`);

  intervalHandle = setInterval(() => {
    sec--;
    changeStatus("success", "nextSearchSec", `다음 검색까지 ${sec}초`);
  }, 1000);

  timeoutHandle = setTimeout(searchInterval, 1000 * 60 * setting.interval);

  isSearcing = false;
};

// 앱 두번째 실행때
app.on("second-instance", () => {
  createWindow();
});

// 모든 창이 닫길 때 global.win 비우기
app.on("window-all-closed", () => {
  global.win = null;
});

// 앱이 준비되었을 때
app.whenReady().then(() => {
  createWindow();

  const resourcesPath = app.isPackaged
    ? path.join(process.resourcesPath, "resources")
    : "resources";

  const icon = nativeImage.createFromPath(`${resourcesPath}/windows/logo.ico`);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: "앱 화면 보기", type: "normal", click: () => createWindow() },
    {
      label: "대기시간 무시하고 바로 검색 시작하기",
      type: "normal",
      click: () => searchInterval(),
    },
    { type: "separator" },
    { label: "앱 끄기", role: "quit", type: "normal" },
  ]);

  tray.setTitle("LAAS");
  tray.setToolTip("LAAS");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    createWindow();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
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

// 검색 바로 시작 요청시 처리
ipcMain.on("requestNowSearch", () => {
  searchInterval();
});

// 크롤링 브라우저 생성
ipcMain.handle("initBrowser", async () => {
  const items = itemStore.get("notification");

  if (global.page) {
    console.log("existBrowser");

    if (!items.length) {
      searchInterval();
    }

    return "existBrowser";
  }

  const setting = configStore.get("notification");

  if (!setting.lostarkID || !setting.lostarkPW) {
    changeStatus(
      "warning",
      "configNeeded",
      "로스트아크 계정을 설정해주세요 :)"
    );
    return "configNeeded";
  }

  global.page = await initBrowser(setting);

  if (!global.page) {
    changeStatus("error", "loginFail", "로스트아크 로그인 실패");
    console.log("loginFail");
    return "loginFail";
  }

  searchInterval();

  console.log("initBrowser ok");
  return "ok";
});

// 로그 데이터가 변경되었을 때 변경되었다는 이벤트 생성
logStore.onDidChange("notification", (logs) => {
  if (global.win) global.win.webContents.send("logs", logs);
});

// 검색 아이템이 변경되었을 때
itemStore.onDidChange("notification", (items, beforeItems) => {
  if (items.length === 0) {
    searchInterval();
  }

  if (beforeItems.length === 0 && items.length) {
    searchInterval();
  }
});

// 설정이 변경되었을 때 필수 값들을 확인 후 매물 검색 실행
configStore.onDidChange("notification", () => {
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

const setting = configStore.get("notification");

if (!setting.saveLogs) {
  logStore.clear();
}

const playwright = require("playwright");

const chromium = playwright.chromium;

const browserName = 'chrome'
const HOST = "https://lostark.game.onstove.com";
const URL = "/Auction";

const userData =
  browserName === "whale"
    ? "C:/Users/2sky/AppData/Local/Naver/Naver Whale/User Data"
    : "C:/Users/2sky/AppData/Local/Google/Chrome/User Data";

const chromePath =
  process.env.NODE_ENV === "dev"
    ? "./resources/windows/chrome/chrome.exe"
    : path.resolve(__dirname, "../../resources/windows/chrome/chrome.exe");

async function test(options = {}) {
  let context;

  context = await chromium.launchPersistentContext(__dirname + "/chrome_data", {
    headless: options.headless || false,
    executablePath: chromePath,
    baseURL: HOST,
    locale: "ko-KR",
    viewport: null,
  });

  const page = context.pages()[0];

  await page.goto(URL);

  await page.waitForLoadState("domcontentloaded");
  
  console.log(page.url());

  if (page.url().includes("https://member.onstove.com/auth/login")) {
    await page.waitForURL(`**${URL}`, { timeout: 0 })
    context.close()
    await test({ headless: false });
  }

  // try {
  //   await page.waitForURL(`**${URL}`, {
  //     timeout: 5000,
  //   });

  //   isInitBrowserProcessing = false;

  //   return page;
  // } catch (error) {
  //   return null;
  // }
}

test();

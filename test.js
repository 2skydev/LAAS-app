const playwright = require("playwright");

const chromium = playwright.chromium;

const browserName = 'chrome'
const HOST = "https://lostark.game.onstove.com";
const URL = "/Auction";

const userData =
  browserName === "whale"
    ? "C:/Users/2sky/AppData/Local/Naver/Naver Whale/User Data"
    : "C:/Users/2sky/AppData/Local/Google/Chrome/User Data";

const executablePath =
  browserName === "whale"
    ? "C:/Program Files/Naver/Naver Whale/Application/2.10.124.26/whale.exe"
    : "C:/Program Files/Google/Chrome/Application/chrome.exe";

async function test(options = {}) {
  let context;

  context = await chromium.launchPersistentContext(__dirname + "/User Data", {
    headless: options.headless || false,
    executablePath,
    baseURL: HOST,
    locale: "ko-KR",
    viewport: null,
    args: ["--profile-directory=Default"],
  });

  const page = context.pages()[0];

  await page.goto(URL);

  await page.waitForLoadState("domcontentloaded");
  
  console.log(page.url());

  if (page.url().includes("https://member.onstove.com/auth/login")) {
    await page.waitForURL(`**${URL}`, { timeout: 0 })
    await test({ headless: true })
    context.close()
    return false
  }

  console.log(page.url());

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

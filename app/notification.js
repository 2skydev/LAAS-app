const playwright = require("playwright");
const request = require("request-promise");
const { createDiscordMessage, createLog, changeStatus } = require("./util");
const { configStore, itemStore } = require("./store");

const chromium = playwright.chromium;

const HOST = "https://lostark.game.onstove.com";
const URL = "/Auction";
const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/883991003487404083/XjnZ6iPQxKtb2luM9WEMsT-gv0_o6AUG1wfFXAByiO1jOhRk7whRjF0Is7GuKSXrkyll";

const ACCESSORY = 200000; // firstCategory - 장신구 전체

let count = 0;
let productIDs = [];
let isInitBrowserProcessing = false;

// 크롤링 브라우저 생성
const initBrowser = async (setting) => {
  if (isInitBrowserProcessing) {
    return null;
  } else {
    isInitBrowserProcessing = true;
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    baseURL: HOST,
    locale: "ko-KR",
    viewport: null,
  });

  const page = await context.newPage();
  await page.goto(URL);

  // 로그인 처리
  await page.fill("#user_id", setting.lostarkID);
  await page.fill("#user_pwd", setting.lostarkPW);
  await page.click("#idLogin .btn-text");

  // 페이지 이동이 되었다면
  try {
    await page.waitForURL(`**${URL}`, {
      timeout: 5000,
    });

    isInitBrowserProcessing = false;

    return page;
  } catch (error) {
    return null;
  }
};

// 페이지 내부 javascript 실행
const evaluate = async (test) => {
  await global.page.evaluate(async (test) => {
    let _results = [];
    let _logs = [];

    const createLog = (data) => {
      _logs.push({
        id: performance.now() + Math.random(),
        ..._.omit(data, ["test.search"]),
      });
    };

    const getData = (el, additional = {}) => {
      let price = Number(
        $(el)
          .find(".price-buy em")
          .text()
          .replace(/[\,\s]/g, "")
      );

      let id = $(el).find("button").attr("data-productid");
      let name = $(el).find(".name").text().trim();
      let quality = Number($(el).find(".quality .txt").text().trim());
      let time = $(el).find(".time").text().trim();
      let count = Number(
        $(el).find(".count font").text().replace("회", "").trim()
      );

      let priceRow = $(el)
        .find(".price-row > em")
        .text()
        .replace(/[\,\s]/g, "");

      let characteristic1 = $(el)
        .find(".effect ul:last-child li:first-child")
        .text()
        .trim();

      let characteristic2 = $(el).find(".effect ul:last-child li:nth-child(2)")
        .length
        ? $(el).find(".effect ul:last-child li:nth-child(2)").text().trim()
        : null;

      let engrave1 = $(el)
        .find(".effect ul:first-child li:nth-child(1)")
        .text()
        .trim();
      let engrave2 = $(el)
        .find(".effect ul:first-child li:nth-child(2)")
        .text()
        .trim();

      let debuff = $(el)
        .find(".effect ul:first-child li:last-child")
        .text()
        .trim();

      if (isNaN(count)) count = 0;

      return {
        price,
        id,
        name,
        quality,
        time,
        count,
        priceRow,
        characteristic1,
        characteristic2,
        engrave1,
        engrave2,
        debuff,
        ...additional,
      };
    };

    function search(test) {
      return new Promise((res) => {
        // 검색 초기화
        _request = setRequestInit();

        // 테스트 데이터로 병합
        _request = _.merge(_request, test.search);

        // 검색 실행
        getSearchAjax(async () => {
          const items = $("#auctionListTbody tr:not(.empty)").toArray();

          let i = 0;
          let firstItem = null;

          if (!items.length) {
            createLog({ test, status: "noItems", desc: "매물이 한개도 없음" });
            res();
            return;
          }

          for await (const el of items) {
            let price = $(el)
              .find(".price-buy em")
              .text()
              .replace(/[\,\s]/g, "");

            // 즉시 구매가가 있다면
            if (price !== "-") {
              const data = getData(el, { memo: test.memo });

              if (test.maxPrice >= data.price) {
                createLog({
                  test,
                  result: data,
                  status: "find",
                  desc: "매물을 찾음",
                });

                _results.push(data);

                res();

                break;
              } else {
                if (!firstItem) {
                  firstItem = data;
                }

                if (i + 1 >= items.length) {
                  createLog({
                    test,
                    result: firstItem,
                    status: "overflowMaxPrice",
                    desc: "최대 가격을 넘어감",
                  });
                }
              }
            }

            i++;
          }

          if (!_logs.length) {
            createLog({ test, status: "noPrice", desc: "즉시 입찰가가 없음" });
          }

          res();
        });
      });
    }

    await search(test);

    try {
      await fetch("/_search_success", {
        method: "POST",
        body: JSON.stringify({
          result: _results[0],
          log: _logs[0],
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {}
  }, test);
};

const search = async () => {
  const setting = configStore.get("notification");
  const items = itemStore.get("notification");

  if (!items.length) {
    return false;
  }

  count++;

  const logs = await new Promise(async (resolve) => {
    try {
      const tests = items.map((item) => {
        let test = {
          maxPrice: item.maxPrice,
          memo: item.memo,
          item: item,
          search: {
            firstCategory: ACCESSORY,
            itemTier: 3,
            itemGrade: 5,
            sortOption: { Sort: "BUY_PRICE", IsDesc: false },
            etcOptionList: [],
          },
        };

        if (item.native.accessory) {
          test.search.secondCategory = item.native.accessory;
        }

        if (item.native.quality) {
          test.search.gradeQuality = item.native.quality;
        }

        if (item.native.characteristic1) {
          test.search.etcOptionList.push({
            firstOption: 2,
            secondOption: item.native.characteristic1,
          });
        }

        if (item.native.characteristic2) {
          test.search.etcOptionList.push({
            firstOption: 2,
            secondOption: item.native.characteristic2,
          });
        }

        if (item.native.engrave1) {
          test.search.etcOptionList.push({
            firstOption: 3,
            secondOption: item.native.engrave1,
            ...(item.engrave1min ? { minValue: item.engrave1min } : {}),
          });
        }

        if (item.native.engrave2) {
          test.search.etcOptionList.push({
            firstOption: 3,
            secondOption: item.native.engrave2,
            ...(item.engrave2min ? { minValue: item.engrave2min } : {}),
          });
        }

        return test;
      });

      let results = [];
      let logs = [];
      let i = 0;

      // 검색 성공 리스너
      await global.page.route(`**/_search_success`, async (route, req) => {
        const { result, log } = req.postDataJSON();

        logs.push(log);
        if (result) results.push(result);

        route.abort();
      });

      // 실제 검색 처리
      for await (const test of tests) {
        changeStatus(
          "processing",
          "searchProcessing",
          `매물 검색 진행중 ${i + 1}/${tests.length}`
        );
        await evaluate(test);
        i++;
      }

      if (results.length) {
        changeStatus(
          "processing",
          "notificationProcessing",
          `디스코드 알림 처리중`
        );
      }

      // 디스코드 웹훅 봇 실행
      for await (const item of results) {
        if (productIDs.includes(item.id)) {
          if (!setting.repeat) {
            continue;
          }
        } else {
          productIDs.push(item.id);
        }

        await request.post(DISCORD_WEBHOOK_URL, {
          json: {
            content: createDiscordMessage(setting.discordUserID, item),
          },
        });
      }

      // 이미 알림 발송한 매물은 발송 했다고 로그에 추가
      logs = logs.map((log) => {
        if (log.status !== "find") {
          return log;
        }

        log.repeat = productIDs.includes(log.result.id);
        log.sendNotification = setting.repeat || !log.repeat;

        return log;
      });

      // 로그 반환
      resolve(
        logs.map((log) => ({
          count,
          ...log,
        }))
      );
    } catch (error) {}
  });

  await global.page.unroute("**/_search_success");

  createLog(...logs);
};

module.exports = {
  initBrowser,
  search,
};

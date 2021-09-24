const playwright = require("playwright");
const request = require("request-promise");
const { createDiscordMessage, createLog } = require("./util");
const { configStore, itemStore } = require("./store");

const chromium = playwright.chromium;

const HOST = "https://lostark.game.onstove.com";
const URL = "/Auction";
const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/883991003487404083/XjnZ6iPQxKtb2luM9WEMsT-gv0_o6AUG1wfFXAByiO1jOhRk7whRjF0Is7GuKSXrkyll";

const ACCESSORY = 200000; // firstCategory - 장신구 전체

let count = 0;
let productIDs = [];

// 크롤링 브라우저 생성
const initBrowser = async (setting) => {
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
    return page;
  } catch (error) {
    return null;
  }
};

// page.route에 사용할 검색 성공 callback
const searchSuccessRoute = (resolve, setting) => async (route, req) => {
  route.abort();
  const { results, logs } = req.postDataJSON();

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

  resolve(
    logs.map((log) => ({
      count,
      ...log,
    }))
  );
};

// 페이지 내부 javascript 실행
const evaluate = async (tests) => {
  await global.page.evaluate(async (tests) => {
    let _results = [];
    let _logs = [];

    const createLog = (data) => {
      _logs.push({
        id: performance.now() + Math.random(),
        ...data,
      });
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

          if (!items.length) {
            createLog({ test, status: "no-items", desc: "매물이 한개도 없음" });
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
              let id = $(el).find("button").attr("data-productid");
              let name = $(el).find(".name").text().trim();
              let quality = Number($(el).find(".quality .txt").text().trim());
              let count = Number(
                $(el).find(".count font").text().replace("회", "").trim()
              );
              let time = $(el).find(".time").text().trim();
              let priceRow = $(el)
                .find(".price-row > em")
                .text()
                .replace(/[\,\s]/g, "");

              let characteristic1 = $(el)
                .find(".effect ul:last-child li:first-child")
                .text()
                .trim();
              let characteristic2 = $(el).find(
                ".effect ul:last-child li:nth-child(2)"
              ).length
                ? $(el)
                    .find(".effect ul:last-child li:nth-child(2)")
                    .text()
                    .trim()
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

              price = Number(price);

              if (isNaN(count)) count = 0;

              const data = {
                id,
                name,
                quality,
                count,
                price,
                debuff,
                time,
                characteristic1,
                characteristic2,
                engrave1,
                engrave2,
                priceRow,
                memo: test.memo,
              };

              if (test.maxPrice >= price) {
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
                if (i + 1 >= items.length) {
                  createLog({
                    test,
                    result: data,
                    status: "overflow-maxPrice",
                    desc: "최대 가격을 넘어감",
                  });
                }
              }
            }

            i++;
          }

          res();
        });
      });
    }

    for await (const test of tests) {
      await search(test);
    }

    try {
      await fetch("/_search_success", {
        method: "POST",
        body: JSON.stringify({
          results: _results,
          logs: _logs,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {}
  }, tests);
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

        if (item.accessory) {
          test.search.secondCategory = item.accessory;
        }

        if (item.quality) {
          test.search.gradeQuality = item.quality;
        }

        if (item.characteristic1) {
          test.search.etcOptionList.push({
            firstOption: 2,
            secondOption: item.characteristic1,
          });
        }

        if (item.characteristic2) {
          test.search.etcOptionList.push({
            firstOption: 2,
            secondOption: item.characteristic2,
          });
        }

        if (item.engrave1) {
          test.search.etcOptionList.push({
            firstOption: 3,
            secondOption: item.engrave1,
            ...(item.engrave1min ? { minValue: item.engrave1min } : {}),
          });
        }

        if (item.engrave2) {
          test.search.etcOptionList.push({
            firstOption: 3,
            secondOption: item.engrave2,
            ...(item.engrave2min ? { minValue: item.engrave2min } : {}),
          });
        }

        return test;
      });

      // 검색 성공 리스너
      await global.page.route(
        `**/_search_success`,
        searchSuccessRoute(resolve, setting)
      );

      // 페이지 내부 javascript 실행
      await evaluate(global.page, tests);
    } catch (error) {}
  });

  await global.page.unroute("**/_search_success");

  createLog(logs);
};

module.exports = {
  initBrowser,
  search,
};

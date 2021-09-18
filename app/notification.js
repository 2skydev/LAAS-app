const playwright = require("playwright");
const request = require("request-promise");
const moment = require("moment");

const chromium = playwright.chromium;

const HOST = "https://lostark.game.onstove.com";
const URL = "/Auction";
const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/883991003487404083/XjnZ6iPQxKtb2luM9WEMsT-gv0_o6AUG1wfFXAByiO1jOhRk7whRjF0Is7GuKSXrkyll";

const ACCESSORY = 200000; // firstCategory - 장신구 전체

let count = 0;
let productIDs = [];

const initBrowser = async (setting) => {
  const browser = await chromium.launch({
    headless: false,
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

  // 페이지 이동될 때 까지 대기
  await page.waitForURL(`**${URL}`);

  return page;
};

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
        content: `:bell: <@${
          setting.discordUserID
        }>님 찾으시던 매물이 발견되었습니다!

> 아이템 이름: \`${item.name}\`
> 즉시 구매가: \`${item.price.toLocaleString()} 골드\`
> 품질: \`${item.quality}\`

**각인 정보**
\`\`\`
${item.engrave1}
${item.engrave2}
\`\`\`\`\`\`css
${item.debuff}
\`\`\`
**특성 정보**
\`\`\`
${item.characteristic1}${
          item.characteristic2 ? `\n${item.characteristic2}` : ""
        }
\`\`\`
**기타 상세 정보**
\`\`\`
거래: [구매 시 거래 ${item.count ? `${item.count}회 가능` : "불가능"}]
남은시간: ${item.time}
최소 입찰가: ${item.priceRow.toLocaleString()} 골드
메모: ${item.memo || "작성한 메모가 없습니다"}
\`\`\`- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    `,
      },
    });
  }

  resolve(
    logs.map((log) => ({
      count,
      time: moment().format("HH:mm:ss"),
      ...log,
    }))
  );
};

// 페이지 내부 javascript 실행
const evaluate = async (page, tests) => {
  await page.evaluate(async (tests) => {
    let _results = [];
    let _logs = [];

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
            _logs.push({
              test: test,
              status: "no-items",
              desc: "매물이 한개도 없음",
              id: performance.now() + Math.random(),
            });

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
                _logs.push({
                  test,
                  result: data,
                  status: "find",
                  desc: "매물을 찾음",
                  id: performance.now() + Math.random(),
                });

                _results.push(data);

                res();

                break;
              } else {
                if (i + 1 >= items.length) {
                  _logs.push({
                    test,
                    result: data,
                    status: "overflow-maxPrice",
                    desc: "최대 가격을 넘어감",
                    id: performance.now() + Math.random(),
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

const search = async (page, items, setting) => {
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
      await page.route(
        `**/_search_success`,
        searchSuccessRoute(resolve, setting)
      );

      // 페이지 내부 javascript 실행
      await evaluate(page, tests);
    } catch (error) {}
  });

  await page.unroute("**/_search_success");

  return logs;
};

module.exports = {
  initBrowser,
  search,
};

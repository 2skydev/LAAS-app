import playwright from "playwright";
import request from "request-promise";
import moment from "moment";

const chromium = playwright.chromium;

const HOST = "https://lostark.game.onstove.com";
const URL = "/Auction";
const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/883991003487404083/XjnZ6iPQxKtb2luM9WEMsT-gv0_o6AUG1wfFXAByiO1jOhRk7whRjF0Is7GuKSXrkyll";
const DISCORD_USERNAME = "이하늘";

const INTERVAL_MINUTE = 1; // 반복 딜레이 (분 단위)

const ACCESSORY = 200000; // firstCategory - 장신구 전체
const NECKLACE = 200010; // secondCategory - 목걸이
const EARRING = 200020; // secondCategory - 귀걸이
const RING = 200030; // secondCategory - 반지

const REPEAT = false; // 알림 반복할지

let productIDs = [];

const tests = [
  {
    maxPrice: 30000,
    search: {
      firstCategory: ACCESSORY,
      secondCategory: EARRING,
      itemTier: 3,
      itemGrade: 5,
      gradeQuality: 80,
      sortOption: { Sort: "BUY_PRICE", IsDesc: false },
      etcOptionList: [
        { firstOption: 2, secondOption: 16 },
        { firstOption: 3, secondOption: 141, minValue: 5 },
        { firstOption: 3, secondOption: 118 },
      ],
    },
  },
  {
    maxPrice: 30000,
    search: {
      firstCategory: ACCESSORY,
      secondCategory: EARRING,
      itemTier: 3,
      itemGrade: 5,
      gradeQuality: 80,
      sortOption: { Sort: "BUY_PRICE", IsDesc: false },
      etcOptionList: [
        { firstOption: 2, secondOption: 16 },
        { firstOption: 3, secondOption: 291, minValue: 5 },
        { firstOption: 3, secondOption: 141 },
      ],
    },
  },
  {
    maxPrice: 30000,
    search: {
      firstCategory: ACCESSORY,
      secondCategory: RING,
      itemTier: 3,
      itemGrade: 5,
      gradeQuality: 80,
      sortOption: { Sort: "BUY_PRICE", IsDesc: false },
      etcOptionList: [
        { firstOption: 2, secondOption: 16 },
        { firstOption: 3, secondOption: 291, minValue: 5 },
        { firstOption: 3, secondOption: 118 },
      ],
    },
  },
  {
    maxPrice: 30000,
    search: {
      firstCategory: ACCESSORY,
      secondCategory: RING,
      itemTier: 3,
      itemGrade: 5,
      gradeQuality: 80,
      sortOption: { Sort: "BUY_PRICE", IsDesc: false },
      etcOptionList: [
        { firstOption: 2, secondOption: 16 },
        { firstOption: 3, secondOption: 291, minValue: 5 },
        { firstOption: 3, secondOption: 121 },
      ],
    },
  },
];

const executeTests = async () => {
  try {
    console.log("------------------------------------------");
    console.log("매물 찾기 시작 시간:", moment().format("YYYY-MM-DD HH:mm:ss"));

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

    await page.route(`**/_search_success`, async (route, req) => {
      route.abort();
      const results = req.postDataJSON();

      console.log("찾은 매물:", `${results.length}개`);

      // 디스코드 웹훅 봇 실행
      for await (const item of results) {
        if (productIDs.includes(item.id)) {
          if (!REPEAT) {
            continue;
          }
        } else {
          productIDs.push(item.id);
        }

        await request.post(DISCORD_WEBHOOK_URL, {
          json: {
            content: `:bell: ${DISCORD_USERNAME}님 찾으시던 매물이 발견되었습니다!

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
\`\`\`- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    `,
          },
        });
      }

      await browser.close();
    });

    // 로그인 처리
    await page.fill("#user_id", "2skydev@gmail.com");
    await page.fill("#user_pwd", "2skydev!=0");
    await page.click("#idLogin .btn-text");

    // 페이지 이동될 때 까지 대기
    await page.waitForURL(`**${URL}`);

    // 페이지 내부 javascript 실행
    await page.evaluate(async (tests) => {
      let _results = [];

      function search(test) {
        return new Promise((res) => {
          // 검색 초기화
          _request = setRequestInit();

          // 테스트 데이터로 병합
          _request = _.merge(_request, test.search);

          // 검색 실행
          getSearchAjax(async () => {
            const items = $("#auctionListTbody tr:not(.empty)").toArray();

            if (!items.length) {
              res();
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
                  ".effect ul:last-child li:last-child"
                ).length
                  ? $(el)
                      .find(".effect ul:last-child li:last-child")
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

                if (test.maxPrice >= price) {
                  _results.push({
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
                  });
                }

                res();

                break;
              }
            }
          });
        });
      }

      for await (const test of tests) {
        await search(test);
      }

      try {
        await fetch("/_search_success", {
          method: "POST",
          body: JSON.stringify(_results),
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (error) {}
    }, tests);
  } catch (error) {}
};

executeTests();

setInterval(() => {
  executeTests();
}, 1000 * 60 * INTERVAL_MINUTE);

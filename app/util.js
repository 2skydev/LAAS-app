const moment = require("moment");
const { logStore } = require("./store");

const createDiscordMessage = (discordUserID, data) => {
  const count = data.count ? `${data.count}회 가능` : "불가능";
  const characteristic2 = data.characteristic2
    ? `\n${data.characteristic2}`
    : "";

  return `:bell: <@${discordUserID}>님 찾으시던 매물이 발견되었습니다!

> 아이템 이름: \`${data.name}\`
> 즉시 구매가: \`${data.price.toLocaleString()} 골드\`
> 품질: \`${data.quality}\`

**각인 정보**
\`\`\`
${data.engrave1}
${data.engrave2}
\`\`\`\`\`\`css
${data.debuff}
\`\`\`
**특성 정보**
\`\`\`
${data.characteristic1}${characteristic2}
\`\`\`
**기타 상세 정보**
\`\`\`
거래: [구매 시 거래 ${count}]
남은시간: ${data.time}
최소 입찰가: ${data.priceRow.toLocaleString()} 골드
메모: ${data.memo || "작성한 메모가 없습니다"}
\`\`\`- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -`;
};

const createLog = (...datas) => {
  const logs = logStore.get("notification");

  logs.push(
    ...datas.map((data) => ({
      id: performance.now() + Math.random(),
      createdAt: moment().toISOString(),
      ...data,
    }))
  );

  logStore.set("notification", logs);
};

module.exports = {
  createDiscordMessage,
  createLog,
};

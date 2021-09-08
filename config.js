const ACCESSORY = 200000; // firstCategory - 장신구 전체
const NECKLACE = 200010; // secondCategory - 목걸이
const EARRING = 200020; // secondCategory - 귀걸이
const RING = 200030; // secondCategory - 반지

export const DISCORD_USERNAME = "이하늘";

export const tests = [
  {
    maxPrice: 100000,
    search: {
      firstCategory: ACCESSORY,
      secondCategory: NECKLACE,
      itemTier: 3,
      itemGrade: 5,
      gradeQuality: 10,
      sortOption: { Sort: "BUY_PRICE", IsDesc: false },
      etcOptionList: [
        { firstOption: 2, secondOption: 18 },
        { firstOption: 2, secondOption: 15 },
        { firstOption: 3, secondOption: 141, minValue: 5 },
        { firstOption: 3, secondOption: 254 },
      ],
    },
  },
];

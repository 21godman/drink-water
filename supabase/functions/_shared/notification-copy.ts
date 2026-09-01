export type NotificationLanguage = "en" | "zh-TW" | "th";

export type NotificationMessage = {
  title: string;
  body: string;
};

export const notificationMessages: Record<
  NotificationLanguage,
  readonly NotificationMessage[]
> = {
  "zh-TW": [
    {
      title: "水水補給站開門啦 💧",
      body: "喝幾口水，讓今天的你繼續閃閃發亮",
    },
    {
      title: "咕嚕咕嚕時間到 🫧",
      body: "小水杯在等你，現在補一口剛剛好",
    },
    {
      title: "身體敲敲你的杯子 🥤",
      body: "它說：可以請我喝點水嗎？",
    },
    {
      title: "小水滴來報到 💦",
      body: "接住這份清爽，慢慢喝幾口吧",
    },
    {
      title: "喝水小任務出現 ✨",
      body: "拿起水杯，咕嚕幾口就完成！",
    },
    {
      title: "先休息一下下 🌿",
      body: "喝口水、喘口氣，再繼續也不遲",
    },
    {
      title: "水杯正在想你 👀",
      body: "別讓它等太久，去陪它一下吧",
    },
    {
      title: "今日份清爽送達 📦",
      body: "簽收方式：喝幾口水",
    },
    {
      title: "幫身體充個水 🔋",
      body: "電量要充，水分也要補",
    },
    {
      title: "喝水隊長呼叫你 🫡",
      body: "帶上水杯，完成這次可愛補給！",
    },
  ],
  en: [
    {
      title: "The water station is open 💧",
      body: "Take a few sips and keep shining today",
    },
    {
      title: "Sip sip time 🫧",
      body: "Your little cup is waiting for you",
    },
    {
      title: "Your body is tapping the cup 🥤",
      body: "It says: Can I have some water?",
    },
    {
      title: "A tiny water drop is here 💦",
      body: "Catch this fresh feeling and take a few slow sips",
    },
    {
      title: "A water quest appeared ✨",
      body: "Pick up your cup and take a few sips to win!",
    },
    {
      title: "Take a tiny break 🌿",
      body: "Sip some water, take a breath, then carry on",
    },
    {
      title: "Your water cup misses you 👀",
      body: "Don't keep it waiting too long",
    },
    {
      title: "Today's freshness has arrived 📦",
      body: "How to receive it: Take a few sips",
    },
    {
      title: "Give your body a water boost 🔋",
      body: "Batteries need charging and bodies need water",
    },
    {
      title: "Your water captain is calling 🫡",
      body: "Grab your cup and complete this cute refill quest!",
    },
  ],
  th: [
    {
      title: "สถานีเติมน้ำเปิดแล้ว 💧",
      body: "จิบน้ำสักหน่อย แล้วไปเปล่งประกายต่อกัน",
    },
    {
      title: "ได้เวลาดื่มน้ำแล้ว 🫧",
      body: "แก้วใบน้อยกำลังรอคุณอยู่ เติมสักหน่อยกำลังดี",
    },
    {
      title: "ร่างกายกำลังเคาะแก้ว 🥤",
      body: "เขาบอกว่า: ขอน้ำหน่อยได้ไหม?",
    },
    {
      title: "หยดน้ำน้อยมารายงานตัว 💦",
      body: "รับความสดชื่นนี้ไว้ แล้วค่อย ๆ จิบน้ำกัน",
    },
    {
      title: "ภารกิจดื่มน้ำมาแล้ว ✨",
      body: "หยิบแก้วขึ้นมา จิบไม่กี่ทีก็สำเร็จ!",
    },
    {
      title: "พักแป๊บหนึ่งนะ 🌿",
      body: "จิบน้ำ หายใจสบาย ๆ แล้วค่อยไปต่อ",
    },
    {
      title: "แก้วน้ำคิดถึงคุณ 👀",
      body: "อย่าปล่อยให้รอนาน ไปหาเขาหน่อยนะ",
    },
    {
      title: "ความสดชื่นวันนี้มาส่งแล้ว 📦",
      body: "วิธีรับของ: จิบน้ำสักหน่อย",
    },
    {
      title: "เติมน้ำให้ร่างกายหน่อย 🔋",
      body: "แบตต้องชาร์จ ร่างกายก็ต้องเติมน้ำ",
    },
    {
      title: "หัวหน้าทีมดื่มน้ำเรียกหา 🫡",
      body: "หยิบแก้วแล้วทำภารกิจเติมน้ำสุดน่ารักนี้ให้สำเร็จ!",
    },
  ],
};

export function isNotificationLanguage(
  value: unknown,
): value is NotificationLanguage {
  return value === "en" || value === "zh-TW" || value === "th";
}

export function notificationMessage(
  language: unknown,
  random: () => number = Math.random,
): NotificationMessage {
  const selectedLanguage = isNotificationLanguage(language)
    ? language
    : "zh-TW";
  const messages = notificationMessages[selectedLanguage];
  const randomValue = Math.max(0, Math.min(random(), 0.999999999));
  return messages[Math.floor(randomValue * messages.length)];
}

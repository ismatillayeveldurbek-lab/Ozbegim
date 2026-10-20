import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function signUp(page: Page, name: string) {
  const email = `e2e-${randomUUID().slice(0, 8)}@sinov.uz`;
  await page.goto("/royxat");
  await page.getByLabel("Ism").fill(name);
  await page.getByLabel("Elektron pochta").fill(email);
  await page.getByLabel("Parol").fill("parol-12345");
  await page.getByRole("button", { name: "Ro‘yxatdan o‘tish" }).click();
  await page.waitForURL("**/");
  return email;
}

test("bosh sahifa: to‘rtta asosiy vosita birinchi, gorizontal siljish yo‘q", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("region", { name: "Asosiy vositalar" }).or(page.locator("section[aria-labelledby=main-tools]"));
  const cards = main.getByRole("link");
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0)).toContainText("Lotin ↔ Kirill");
  await expect(cards.nth(1)).toContainText("Iboralar ma’nosi");
  await expect(cards.nth(2)).toContainText("Imlo tekshiruvi");
  await expect(cards.nth(3)).toContainText("O‘zlashma so‘zlar");
  await noHorizontalScroll(page);
});

test("navigatsiya: telefonda pastki menyu va “Yana”, kompyuterda chap panel", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    const nav = page.getByRole("navigation", { name: "Asosiy bo‘limlar" });
    await expect(nav.getByRole("link")).toHaveCount(4);
    await nav.getByRole("button", { name: "Yana" }).click();
    const dialog = page.getByRole("dialog", { name: "Qo‘shimcha vositalar" });
    await expect(dialog.getByRole("link", { name: /So‘z va gap tahlili/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  } else {
    const side = page.getByRole("complementary", { name: "Asosiy navigatsiya" });
    await expect(side.getByRole("link", { name: "Imlo tekshiruvi" })).toBeVisible();
  }
});

test("konvertor: O‘zbekiston → Ўзбекистон, havola o‘zgarmaydi, yo‘nalish almashtirilganda natija yo‘qolmaydi", async ({ page }) => {
  await page.goto("/konvertor");
  await page.getByLabel("Asl matn").fill("O‘zbekiston. Shahar: https://shahar.uz");
  await expect(page.getByLabel("Natija")).toHaveValue("Ўзбекистон. Шаҳар: https://shahar.uz");
  await page.getByRole("button", { name: "Yo‘nalishni almashtirish" }).click();
  await expect(page.getByLabel("Asl matn")).toHaveValue("Ўзбекистон. Шаҳар: https://shahar.uz");
  await expect(page.getByLabel("Natija")).toHaveValue("O‘zbekiston. Shahar: https://shahar.uz");
  await noHorizontalScroll(page);
});

test("mavjud bo‘lmagan so‘z: aniq xabar va “Izohlar” bo‘limi; ikki foydalanuvchi izohni ko‘radi", async ({ browser, page }) => {
  const word = `sinovsoz${randomUUID().replace(/[^a-z]/g, "").slice(0, 6)}`;
  await page.goto(`/ozlashma?q=${word}`);
  await expect(page.getByText("Bu so‘z hozircha bazada mavjud emas. Ma’nosi yoki o‘zbekcha muqobilini bilsangiz, izoh qoldiring.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Izohlar/ })).toBeVisible();
  await expect(page.getByText("tizimga kiring")).toBeVisible();

  await signUp(page, "Birinchi");
  await page.goto(`/ozlashma?q=${word}`);
  await page.getByLabel("Taklif etilayotgan muqobil yoki ma’no").fill("e2e muqobil");
  await page.getByLabel("Tushuntirish").fill("Brauzer orqali qoldirilgan izoh.");
  await page.getByRole("button", { name: "Izoh qoldirish" }).click();
  await expect(page.getByText("e2e muqobil")).toBeVisible();

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await signUp(p2, "Ikkinchi");
  await p2.goto(`/ozlashma?q=${word.toUpperCase()}`);
  await expect(p2.getByText("e2e muqobil")).toBeVisible();
  await expect(p2.getByText("Hamjamiyat taklifi").first()).toBeVisible();
  await ctx2.close();
});

test("imlo: qabul qilish, rad etish va ortga qaytarish", async ({ page }) => {
  await page.goto("/imlo");
  const ta = page.getByLabel("Matn", { exact: true });
  await ta.fill("Bugun kop malumot keldi.");
  const list = page.getByRole("complementary", { name: /Tavsiyalar/ });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await list.getByRole("button", { name: "Qabul qilish" }).first().click();
  await expect(ta).toHaveValue("Bugun ko‘p malumot keldi.");
  await list.getByRole("button", { name: "Rad etish" }).first().click();
  await expect(list.getByRole("listitem")).toHaveCount(0);
  await page.getByRole("button", { name: "Ortga qaytarish" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Ortga qaytarish" }).click();
  await expect(ta).toHaveValue("Bugun kop malumot keldi.");
});

test("fayl: TXT yuklanadi, ishlanadi va yuklab olinadi; oddiy foydalanuvchiga admin yopiq", async ({ page }) => {
  await signUp(page, "Fayl");
  await page.goto("/konvertor/fayl");
  await page.locator("#file-input").setInputFiles({ name: "salom.txt", mimeType: "text/plain", buffer: Buffer.from("Shahar markazi") });
  const job = page.getByRole("listitem").filter({ hasText: "salom.txt" });
  await expect(job.getByText("Tayyor")).toBeVisible({ timeout: 30_000 });
  const dl = page.waitForEvent("download");
  await job.getByRole("link", { name: "Yuklab olish" }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe("salom.kirill.txt");
  await page.goto("/admin");
  await expect(page.getByText("Ruxsat yo‘q")).toBeVisible();
});

test("tahlil va statistika sahifalari", async ({ page }) => {
  await page.goto("/tahlil");
  await page.getByLabel("So‘z", { exact: true }).fill("kitoblarimizdan");
  await page.getByRole("button", { name: "Tahlil qilish" }).click();
  await expect(page.getByText("ki - tob - la - ri - miz - dan")).toBeVisible();
  await page.goto("/statistika");
  await page.getByLabel("Matn").fill("Bir ikki. Uch!");
  await expect(page.getByText("So‘zlar", { exact: true }).locator("..")).toContainText("3");
  await noHorizontalScroll(page);
});

test("so‘z tahlilchisi: bo‘sh so‘z xabari, Enter bilan yuborish, AI ulanmagan holat", async ({ page }) => {
  await page.goto("/soz-tahlilchisi");
  const input = page.getByPlaceholder("So‘z kiriting...");
  await expect(input).toBeVisible();
  await page.getByRole("button", { name: "Tahlil qilish" }).click();
  await expect(page.getByText("Iltimos, so‘z kiriting")).toBeVisible();
  await input.fill("kitob");
  await input.press("Enter");
  await expect(page.getByText("Xizmat ulanmagan — so‘z tahlilchisi hozircha ishlamaydi.")).toBeVisible();
  await noHorizontalScroll(page);
});

test("turistlar tarjimoni: bo‘sh matn xabari va AI ulanmagan holat", async ({ page }) => {
  await page.goto("/tarjima");
  await page.getByRole("button", { name: "Tarjima qilish" }).click();
  await expect(page.getByText("Iltimos, tarjima qilinadigan matnni kiriting")).toBeVisible();
  await page.getByLabel("Matn (istalgan tilda)").fill("Where is the nearest pharmacy?");
  await page.getByRole("button", { name: "Tarjima qilish" }).click();
  await expect(page.getByText("Xizmat ulanmagan — tarjimon hozircha ishlamaydi.")).toBeVisible();
  await noHorizontalScroll(page);
});

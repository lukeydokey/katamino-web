import { expect, test } from "@playwright/test";

test("로컬 Katamino 기본 배치 흐름이 동작한다", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Katamino 웹 재구현" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /블록 12/ }).click();
  await page.getByRole("button", { name: "선택 블록 회전" }).click();
  await page.getByRole("button", { name: "3,3 칸" }).click();

  await expect(page.getByText("사용 완료 블록 수: 1 / 12")).toBeVisible();
  await expect(page.getByText("선택된 블록: 없음")).toBeVisible();
  await expect(page.getByText("block12 배치 완료")).toBeVisible();
});

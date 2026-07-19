import { expect, test, type Page } from "@playwright/test";

async function createHostRoom(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "새 방 만들기" }).click();
  await page.waitForURL(/\/room\//);

  const roomUrl = page.url();
  const roomCode = roomUrl.split("/room/")[1]?.split("?")[0];

  if (!roomCode) {
    throw new Error("roomCode를 추출하지 못했습니다.");
  }

  return roomCode;
}

async function joinRoom(page: Page, roomCode: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "룸 코드 입력" }).fill(roomCode);
  await page.getByRole("button", { name: "방 입장하기" }).click();
  await page.waitForURL(new RegExp(`/room/${roomCode}`));
}

async function openChatDrawer(page: Page) {
  const trigger = page.getByRole("button", { name: /채팅/ }).first();
  await trigger.click();
  await expect(page.getByRole("heading", { level: 3, name: "실시간 채팅" })).toBeVisible();
}

test("room 채팅이 새로고침 없이 양방향 동기화되고 reconnect 후 따라잡는다", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  try {
    const roomCode = await createHostRoom(hostPage);
    await joinRoom(guestPage, roomCode);

    await hostPage.getByRole("button", { name: "게임 시작" }).click();
    await expect(hostPage.getByRole("button", { name: "기권하기" })).toBeVisible();
    await expect(guestPage.getByRole("button", { name: "기권하기" })).toBeVisible();

    await openChatDrawer(hostPage);
    await openChatDrawer(guestPage);

    const firstMessage = `host-${Date.now()}`;
    await hostPage.getByPlaceholder("메시지를 입력하세요").fill(firstMessage);
    await hostPage.getByRole("button", { name: "전송" }).click();
    await expect(guestPage.getByText(firstMessage)).toBeVisible();

    await guestContext.setOffline(true);

    const offlineMessage = `offline-${Date.now()}`;
    await hostPage.getByPlaceholder("메시지를 입력하세요").fill(offlineMessage);
    await hostPage.getByRole("button", { name: "전송" }).click();

    await hostPage.waitForTimeout(1500);
    await guestContext.setOffline(false);
    await guestPage.bringToFront();

    await expect(guestPage.getByText(offlineMessage)).toBeVisible({ timeout: 10000 });
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test("room 종료 후 같은 룸에서 다시 시작 흐름이 동작한다", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  try {
    const roomCode = await createHostRoom(hostPage);
    await joinRoom(guestPage, roomCode);

    await hostPage.getByRole("button", { name: "게임 시작" }).click();
    await expect(hostPage.getByRole("button", { name: "기권하기" })).toBeVisible();
    await expect(guestPage.getByRole("button", { name: "기권하기" })).toBeVisible();

    await hostPage.getByRole("button", { name: "기권하기" }).click();

    await expect(hostPage.getByText("기권으로 종료").first()).toBeVisible();
    await expect(hostPage.getByRole("button", { name: "같은 룸에서 다시 시작" })).toBeVisible();

    await hostPage.getByRole("button", { name: "같은 룸에서 다시 시작" }).click();
    await expect(hostPage.getByRole("button", { name: "기권하기" })).toBeVisible({ timeout: 10000 });
    await expect(guestPage.getByRole("button", { name: "기권하기" })).toBeVisible({ timeout: 10000 });
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

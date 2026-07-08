import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

async function joinLobby(page: Page, playerName: string) {
  await page.goto(BASE_URL);
  await page.fill('input[placeholder="请输入您的名字"]', playerName);
  await page.click('button:has-text("进入大厅")');
  await expect(page.locator('h2')).toContainText('游戏大厅');
}

async function waitForSeatUpdate(page: Page, tableIndex: number, seatIndex: number, occupied: boolean) {
  const table = page.locator('.table-card').nth(tableIndex);
  const seat = table.locator('.seat').nth(seatIndex);
  if (occupied) {
    await expect(seat).toHaveClass(/occupied/, { timeout: 5000 });
  } else {
    await expect(seat).not.toHaveClass(/occupied/, { timeout: 5000 });
  }
}

test.describe('中国象棋游戏测试', () => {
  test.describe('大厅功能', () => {
    test('进入大厅', async ({ page }) => {
      await joinLobby(page, '测试玩家1');
      await expect(page.locator('h2')).toContainText('测试玩家1');
      await expect(page.locator('.tables-grid')).toBeVisible();
    });

    test('大厅显示桌子卡片', async ({ page }) => {
      await joinLobby(page, '测试玩家');
      const tableCards = page.locator('.table-card');
      await expect(tableCards).toHaveCount(6);
      const firstTable = tableCards.first();
      await expect(firstTable.locator('.seat')).toHaveCount(2);
    });
  });

  test.describe('双人对战', () => {
    test('两个玩家对弈', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      await joinLobby(page1, '玩家1');
      await joinLobby(page2, '玩家2');

      // 玩家1选择第1张桌子的红方座位
      await page1.locator('.table-card').first().locator('.sit-btn').first().click();

      // 等待玩家1坐下
      await waitForSeatUpdate(page1, 0, 0, true);

      // 玩家2选择第1张桌子的黑方座位
      // 等待桌子状态更新后再点击
      await expect(page2.locator('.table-card').first().locator('.seat').first()).toHaveClass(/occupied/, { timeout: 5000 });
      await page2.locator('.table-card').first().locator('.sit-btn').last().click();

      // 等待游戏开始并跳转
      await expect(page1).toHaveURL(/\/game/, { timeout: 10000 });
      await expect(page2).toHaveURL(/\/game/, { timeout: 10000 });

      await context1.close();
      await context2.close();
    });
  });

  test.describe('单人模式', () => {
    test('一人控制红黑双方', async ({ page }) => {
      await joinLobby(page, '单人玩家');

      const table1 = page.locator('.table-card').first();
      // 选择红方座位
      await table1.locator('.sit-btn').first().click();
      // 等待红方座位变为已占用状态
      await waitForSeatUpdate(page, 0, 0, true);
      // 选择黑方座位
      await table1.locator('.sit-btn').last().click();

      // 模式选择对话框通过 Teleport 渲染到 body
      // 使用 page 级别查找，因为 Teleport 到了 body
      const modeDialog = page.locator('.mode-dialog');
      await expect(modeDialog).toBeVisible({ timeout: 5000 });

      // 等待按钮稳定后再点击
      const singleBtn = page.locator('.mode-btn.single');
      await expect(singleBtn).toBeVisible();
      await singleBtn.click();

      await expect(page).toHaveURL(/\/game/, { timeout: 10000 });
      await expect(page.locator('.mode-tag')).toContainText('单人模式');
    });
  });

  test.describe('AI 对战', () => {
    test('与AI对弈', async ({ page }) => {
      await joinLobby(page, 'AI玩家');

      const table1 = page.locator('.table-card').first();
      await table1.locator('.sit-btn').first().click();
      // 等待红方座位变为已占用状态
      await waitForSeatUpdate(page, 0, 0, true);
      await table1.locator('.sit-btn').last().click();

      const modeDialog = page.locator('.mode-dialog');
      await expect(modeDialog).toBeVisible({ timeout: 5000 });

      const aiBtn = page.locator('.mode-btn.ai');
      await expect(aiBtn).toBeVisible();
      await aiBtn.click();

      // 难度选择对话框
      await expect(modeDialog).toBeVisible({ timeout: 5000 });
      const mediumBtn = page.locator('.mode-btn.medium');
      await expect(mediumBtn).toBeVisible();
      await mediumBtn.click();

      await expect(page).toHaveURL(/\/game/, { timeout: 10000 });
      await expect(page.locator('.mode-tag')).toContainText('人机对战');
    });
  });

  test.describe('旁观者功能', () => {
    test('旁观其他玩家对弈', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const context3 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      const page3 = await context3.newPage();

      await joinLobby(page1, '对弈玩家1');
      await joinLobby(page2, '对弈玩家2');

      // 两个玩家坐下开始对弈
      await page1.locator('.table-card').first().locator('.sit-btn').first().click();
      await waitForSeatUpdate(page1, 0, 0, true);

      await expect(page2.locator('.table-card').first().locator('.seat').first()).toHaveClass(/occupied/, { timeout: 5000 });
      await page2.locator('.table-card').first().locator('.sit-btn').last().click();

      await expect(page1).toHaveURL(/\/game/, { timeout: 10000 });
      await expect(page2).toHaveURL(/\/game/, { timeout: 10000 });

      // 玩家3进入大厅并旁观
      await joinLobby(page3, '旁观者');
      await page3.locator('.table-card').first().locator('.watch-btn').click();

      await expect(page3).toHaveURL(/\/game/, { timeout: 10000 });
      await expect(page3.locator('.spectator-tag')).toContainText('旁观中');

      await context1.close();
      await context2.close();
      await context3.close();
    });
  });

  test.describe('UI 交互', () => {
    test('游戏说明展开/收起', async ({ page }) => {
      await joinLobby(page, 'UI测试');

      const helpContent = page.locator('.help-content');
      await expect(helpContent).not.toBeVisible();

      await page.click('.help-header');
      await expect(helpContent).toBeVisible();

      await page.click('.help-header');
      await expect(helpContent).not.toBeVisible();
    });

    test('离开座位', async ({ page }) => {
      await joinLobby(page, '离开测试');

      const table1 = page.locator('.table-card').first();
      await table1.locator('.sit-btn').first().click();

      // 离开按钮在 card-actions 中，需要 myTableId 匹配才显示
      await expect(table1.locator('.leave-btn')).toBeVisible();
      await table1.locator('.leave-btn').click();

      await expect(table1.locator('.seat-info').first()).toContainText('空位');
    });

    test('离开游戏大厅', async ({ page }) => {
      await joinLobby(page, '退出测试');

      // 点击离开游戏大厅按钮
      await page.click('.logout-btn');

      // 应回到登录界面
      await expect(page.locator('h2')).toContainText('进入游戏大厅');
      await expect(page.locator('input[placeholder="请输入您的名字"]')).toBeVisible();
    });
  });
});

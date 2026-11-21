import { test, expect } from "@playwright/test";
test("login, offline shell and manifest render without invented records", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("Made by Mudasir Shariff");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  expect((await response.json()).display).toBe("standalone");
  await page.goto("/offline.html");
  await expect(
    page.getByRole("heading", { name: "A moment to reconnect." }),
  ).toBeVisible();
});
test("unauthenticated workspace routes redirect to sign in", async ({
  page,
}) => {
  await page.goto("/customers");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/new-bill");
  await expect(page).toHaveURL(/\/login/);
});

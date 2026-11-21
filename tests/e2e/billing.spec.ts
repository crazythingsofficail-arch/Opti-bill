import { test, expect } from "@playwright/test";
/** Run ONLY against a dedicated local/test Supabase project with a configured owner and tax category.
 * This workflow creates test records. Never point these credentials at a production shop. */
test("customer → prescription → items → finalise → print → balance payment → credit note", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.E2E_ALLOW_TEST_WRITES !== "1" ||
      !process.env.E2E_OWNER_EMAIL ||
      !process.env.E2E_OWNER_PASSWORD,
    "Connected test stack and explicit test-write flag required",
  );
  test.skip(
    testInfo.project.name !== "desktop",
    "One transactional workflow per test run",
  );
  const suffix = String(Date.now()).slice(-8);
  const phone = "+9190" + suffix;
  const name = `Test customer ${suffix}`;
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_OWNER_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/new-bill");
  await page.getByRole("button", { name: "Create a new customer" }).click();
  await page.getByLabel("Customer name", { exact: true }).fill(name);
  await page.getByLabel("Mobile number (+91)", { exact: true }).fill(phone);
  await page.getByLabel("Age in years").fill("30");
  await page
    .getByRole("dialog")
    .locator('input[type="checkbox"]')
    .last()
    .check();
  await page
    .getByRole("button", { name: "Create customer", exact: true })
    .click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Add new", exact: true }).click();
  await page.getByLabel("OD sph", { exact: true }).fill("1.25");
  await page.getByLabel("OS sph", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Save prescription", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Test optical lens");
  await page.getByLabel("Unit price before tax (₹)").fill("1000");
  await page
    .getByLabel("Tax category", { exact: true })
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Add to bill", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Add payment", exact: true }).click();
  await page.getByLabel("Amount (₹)", { exact: true }).fill("100");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add payment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finalise & print", exact: true })
    .click();
  await expect(page).toHaveURL(/\/print\//);
  await expect(page.locator(".print-document")).toContainText(
    "Test optical lens",
  );
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.goto(`/invoices/${id}`);
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record payment", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Issue full credit note", exact: true })
    .click();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Test credit note acceptance flow");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("credit note", { exact: true })).toBeVisible();
});

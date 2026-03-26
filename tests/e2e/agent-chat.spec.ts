import { expect, test } from "@playwright/test";

test("streams fake agent events in the chat UI", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel(/send a prompt/i).fill("List installed skills");
  await page.getByRole("button", { name: /send prompt/i }).click();

  await expect(page.getByRole("button", { name: /sending/i })).toBeDisabled();
  await expect(page.getByText("tool_result")).toBeVisible();
  await expect(page.getByText(/^Fake agent response$/).first()).toBeVisible();
  await expect(page.getByText("Fake agent response for: List installed skills").first()).not.toBeVisible();
  await expect(page.getByText("main-agent").first()).toBeVisible();
  await expect(page.getByText("Fake agent response for: List installed skills").first()).toBeVisible();
});

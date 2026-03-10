/**
 * driveImageUtils.ts
 *
 * Utilities to convert Google Drive share links → direct image URLs,
 * and to swap base64 screenshots in your RULES array by rule ID.
 */

// ─── 1. Convert any Google Drive share link to a direct image URL ────────────

/**
 * Extracts the file ID from various Google Drive URL formats and returns
 * a direct image URL that works as an <img src="..."> value.
 *
 * Supported input formats:
 *   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   https://drive.google.com/open?id=FILE_ID
 *   https://drive.google.com/uc?id=FILE_ID&export=download
 *   https://drive.google.com/thumbnail?id=FILE_ID
 */
export function driveShareLinkToDirectUrl(shareLink: string): string {
  let fileId: string | null = null;

  // Format: /file/d/FILE_ID/
  const fileMatch = shareLink.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    fileId = fileMatch[1];
  }

  // Format: ?id=FILE_ID or &id=FILE_ID
  if (!fileId) {
    const idMatch = shareLink.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      fileId = idMatch[1];
    }
  }

  if (!fileId) {
    console.warn("driveShareLinkToDirectUrl: Could not extract file ID from:", shareLink);
    return shareLink; // Return original as fallback
  }

  // thumbnail endpoint works without auth for publicly shared files
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
}


// ─── 2. Swap a screenshot in your RULES array by rule ID ────────────────────

import type { Rule } from "./rulesScreenTypes"; // adjust path as needed

/**
 * Returns a new RULES array with the screenshot for `ruleId` replaced.
 *
 * @param rules       - Your existing RULES array
 * @param ruleId      - The `id` field of the rule you want to update (e.g. "objective")
 * @param shareLink   - A Google Drive share link for the new image
 * @param caption     - Optional caption for the screenshot
 */
export function swapRuleScreenshot(
  rules: Rule[],
  ruleId: string,
  shareLink: string,
  caption?: string
): Rule[] {
  const directUrl = driveShareLinkToDirectUrl(shareLink);

  return rules.map((rule) => {
    if (rule.id !== ruleId) return rule;

    return {
      ...rule,
      screenshot: directUrl,
      screenshotCaption: caption ?? rule.screenshotCaption,
    };
  });
}


/**
 * Swap multiple screenshots at once.
 *
 * @param rules   - Your existing RULES array
 * @param updates - Array of { ruleId, shareLink, caption? }
 */
export function swapMultipleScreenshots(
  rules: Rule[],
  updates: { ruleId: string; shareLink: string; caption?: string }[]
): Rule[] {
  return updates.reduce(
    (acc, { ruleId, shareLink, caption }) =>
      swapRuleScreenshot(acc, ruleId, shareLink, caption),
    rules
  );
}


// ─── 3. Optional: swap inside the `screenshots` array (multi-image rules) ───

/**
 * Replace a specific screenshot inside rule.screenshots[] by index.
 */
export function swapRuleScreenshotAtIndex(
  rules: Rule[],
  ruleId: string,
  index: number,
  shareLink: string,
  caption?: string
): Rule[] {
  const directUrl = driveShareLinkToDirectUrl(shareLink);

  return rules.map((rule) => {
    if (rule.id !== ruleId || !rule.screenshots) return rule;

    const newScreenshots = [...rule.screenshots];
    newScreenshots[index] = {
      src: directUrl,
      caption: caption ?? newScreenshots[index]?.caption,
    };

    return { ...rule, screenshots: newScreenshots };
  });
}
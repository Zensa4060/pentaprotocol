/**
 * rulesScreenTypes.ts
 *
 * Shared types for the rules screen.
 * Import Rule from here instead of re-declaring it in multiple files.
 */

export interface Rule {
  id: string;
  emoji: string;
  title: string;
  summary: string;
  detail: string;
  screenshot: string | null;
  screenshotCaption?: string;
  screenshots?: { src: string; caption?: string }[];
}
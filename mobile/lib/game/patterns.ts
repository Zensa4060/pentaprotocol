/**
 * Pattern metadata accessors by grid size.
 */

import type { GridSize } from "./boardConfig";
import {
  CORE_RULES_METADATA_5,
  PATTERN_METADATA_5,
} from "./patterns5";
import {
  CORE_RULES_METADATA_6,
  PATTERN_METADATA_6,
} from "./patterns6";
import {
  CORE_RULES_METADATA_7,
  PATTERN_METADATA_7,
  type PatternInfo,
} from "./patterns7";

export type { PatternInfo } from "./patterns7";

export function patternMetadataForGrid(grid: GridSize): Record<string, PatternInfo> {
  if (grid === 5) return PATTERN_METADATA_5;
  if (grid === 6) return PATTERN_METADATA_6;
  return PATTERN_METADATA_7;
}

export function coreRulesForGrid(grid: GridSize): Record<string, PatternInfo> {
  if (grid === 5) return CORE_RULES_METADATA_5;
  if (grid === 6) return CORE_RULES_METADATA_6;
  return CORE_RULES_METADATA_7;
}

/**
 * Barrel export for the mobile design system.
 *
 * Screens import from ``@/components/ui`` rather than reaching
 * into individual files — keeps screen-level imports compact
 * and gives us one place to add new primitives without rippling
 * import-site changes.
 */

export { Avatar } from "./Avatar";
export type { AvatarProps } from "./Avatar";

export { Btn } from "./Btn";
export type { BtnProps } from "./Btn";

export { Card } from "./Card";
export type { CardProps } from "./Card";

export { Divider } from "./Divider";
export type { DividerProps } from "./Divider";

export { Screen } from "./Screen";
export type { ScreenProps } from "./Screen";

export { Spinner } from "./Spinner";
export type { SpinnerProps } from "./Spinner";

export { TextField } from "./TextField";
export type { TextFieldProps } from "./TextField";

export { Row, Stack } from "./Stack";

export {
  Body,
  Caption,
  Display,
  Eyebrow,
  Heading,
  Mono,
  Subheading,
  Title,
} from "./Text";

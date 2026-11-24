export type Point = { x: number; y: number };
export type Preset = "paper" | "goo" | "robot";
export type Arm = "squiggle" | "goo" | "spring";
export type Hand = "paper" | "claw" | "robot";
export type Mood = "near" | "touch" | "over" | "away";

export interface ReachOptions {
  /** A ready-made look. Any other option overrides it. Default "paper". */
  preset?: Preset;
  arm?: Arm;
  hand?: Hand;
  armColor?: string;
  inkColor?: string;
  handColor?: string;
  cuffColor?: string;
  /** Highlight on the goo arm and the claw. */
  shineColor?: string;
  /** SVG markup, an image URL, or an Element. Markup is inserted as HTML, so only pass markup you trust. */
  logo?: string | Element;
  /** Pixels. 0 picks a size from the button's height. */
  logoSize?: number;
  /** "button" keeps the button's colour behind the logo, "none" hides it, or any CSS colour. */
  badgeColor?: string;
  badgeRadius?: number;
  /** How close the cursor must be (px from the edge) before the arm comes out. Default 190. */
  ring?: number;
  /** How close before the button turns into the logo. Default 138. */
  morphAt?: number;
  /** How far the hand can stretch. Default 168. */
  reach?: number;
  handSize?: number;
  thickness?: number;
  /** Degrees of 3D lean. 0 turns it off. */
  tilt?: number;
  morph?: boolean;
  wave?: boolean;
  beckon?: boolean;
  shake?: boolean;
  thumbsUp?: boolean;
  /** Say hello once on touch screens. */
  greet?: boolean;
  zIndex?: number;
  onChange?: ((mood: Mood, element: HTMLElement) => void) | null;
  drawArm?: ((ctx: CanvasRenderingContext2D, info: { from: Point; to: Point; time: number; options: ReachOptions }) => void) | null;
  drawHand?: ((ctx: CanvasRenderingContext2D, info: { curl: number; thumb: number; time: number; options: ReachOptions }) => void) | null;
}

export interface ReachHandle {
  update(options: ReachOptions): void;
  destroy(): void;
}

export const presets: Record<Preset, ReachOptions>;
export const defaults: Required<Omit<ReachOptions, "arm" | "hand" | "armColor" | "inkColor" | "handColor" | "cuffColor" | "shineColor">>;
export function reach(target: string | Element | Iterable<Element>, options?: ReachOptions): ReachHandle;
export default reach;

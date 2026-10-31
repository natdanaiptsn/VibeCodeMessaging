/** ชนิดข้อมูล Flex Message ตาม LINE Flex Message Specification */

export type FlexSpacingKeyword = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
export type FlexTextSize = "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "3xl" | "4xl" | "5xl";
export type FlexImageSize = FlexTextSize | "full";
export type FlexBubbleSize = "nano" | "micro" | "deca" | "hecto" | "kilo" | "mega" | "giga";

export type FlexUriAction = { type: "uri"; label?: string; uri: string; altUri?: { desktop: string } };
export type FlexMessageAction = { type: "message"; label?: string; text: string };
export type FlexPostbackAction = {
  type: "postback";
  label?: string;
  data: string;
  displayText?: string;
  inputOption?: "closeRichMenu" | "openRichMenu" | "openKeyboard" | "openVoice";
  fillInText?: string;
};
export type FlexDatetimePickerAction = {
  type: "datetimepicker";
  label?: string;
  data: string;
  mode: "date" | "time" | "datetime";
  initial?: string;
  max?: string;
  min?: string;
};
export type FlexClipboardAction = { type: "clipboard"; label?: string; clipboardText: string };

export type FlexAction =
  | FlexUriAction
  | FlexMessageAction
  | FlexPostbackAction
  | FlexDatetimePickerAction
  | FlexClipboardAction;

type Positioning = {
  position?: "relative" | "absolute";
  offsetTop?: string;
  offsetBottom?: string;
  offsetStart?: string;
  offsetEnd?: string;
};

export type FlexBox = Positioning & {
  type: "box";
  layout: "horizontal" | "vertical" | "baseline";
  contents: FlexComponent[];
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: string;
  cornerRadius?: string;
  width?: string;
  maxWidth?: string;
  height?: string;
  maxHeight?: string;
  flex?: number;
  spacing?: string;
  margin?: string;
  paddingAll?: string;
  paddingTop?: string;
  paddingBottom?: string;
  paddingStart?: string;
  paddingEnd?: string;
  justifyContent?: "center" | "flex-start" | "flex-end" | "space-between" | "space-around" | "space-evenly";
  alignItems?: "center" | "flex-start" | "flex-end";
  background?: {
    type: "linearGradient";
    angle: string;
    startColor: string;
    endColor: string;
    centerColor?: string;
    centerPosition?: string;
  };
  action?: FlexAction;
};

export type FlexSpan = {
  type: "span";
  text: string;
  size?: string;
  color?: string;
  weight?: "regular" | "bold";
  style?: "normal" | "italic";
  decoration?: "none" | "underline" | "line-through";
};

export type FlexText = Positioning & {
  type: "text";
  text?: string;
  contents?: FlexSpan[];
  size?: string;
  weight?: "regular" | "bold";
  color?: string;
  align?: "start" | "end" | "center";
  gravity?: "top" | "bottom" | "center";
  wrap?: boolean;
  lineSpacing?: string;
  maxLines?: number;
  flex?: number;
  margin?: string;
  style?: "normal" | "italic";
  decoration?: "none" | "underline" | "line-through";
  adjustMode?: "shrink-to-fit";
  scaling?: boolean;
  action?: FlexAction;
};

export type FlexImage = Positioning & {
  type: "image";
  url: string;
  size?: string;
  aspectRatio?: string;
  aspectMode?: "fit" | "cover";
  backgroundColor?: string;
  align?: "start" | "end" | "center";
  gravity?: "top" | "bottom" | "center";
  flex?: number;
  margin?: string;
  animated?: boolean;
  action?: FlexAction;
};

export type FlexIcon = Positioning & {
  type: "icon";
  url: string;
  size?: string;
  aspectRatio?: string;
  margin?: string;
  scaling?: boolean;
};

export type FlexButton = Positioning & {
  type: "button";
  action: FlexAction;
  style?: "primary" | "secondary" | "link";
  color?: string;
  height?: "sm" | "md";
  gravity?: "top" | "bottom" | "center";
  flex?: number;
  margin?: string;
  adjustMode?: "shrink-to-fit";
  scaling?: boolean;
};

export type FlexSeparator = { type: "separator"; margin?: string; color?: string };
export type FlexSpacer = { type: "spacer"; size?: FlexSpacingKeyword };
export type FlexFiller = { type: "filler"; flex?: number };
export type FlexVideo = {
  type: "video";
  url: string;
  previewUrl: string;
  altContent: FlexComponent;
  aspectRatio?: string;
  action?: FlexAction;
};

export type FlexComponent =
  | FlexBox
  | FlexText
  | FlexImage
  | FlexIcon
  | FlexButton
  | FlexSeparator
  | FlexSpacer
  | FlexFiller
  | FlexVideo;

export type FlexBlockStyle = { backgroundColor?: string; separator?: boolean; separatorColor?: string };

export type FlexBubble = {
  type: "bubble";
  size?: FlexBubbleSize;
  direction?: "ltr" | "rtl";
  header?: FlexBox;
  hero?: FlexBox | FlexImage | FlexVideo;
  body?: FlexBox;
  footer?: FlexBox;
  styles?: { header?: FlexBlockStyle; hero?: FlexBlockStyle; body?: FlexBlockStyle; footer?: FlexBlockStyle };
  action?: FlexAction;
};

export type FlexCarousel = { type: "carousel"; contents: FlexBubble[] };

export type FlexContainer = FlexBubble | FlexCarousel;

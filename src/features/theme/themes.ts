import { createDarkTheme, createLightTheme, type BrandVariants, type Theme } from "@fluentui/react-components";

/**
 * DRAGHUB brand ramp — a 16-step Fluent BrandVariants scale anchored on the
 * product's lime accent (#B7F34A sits at step 90, the same position Fluent's
 * own brand ramps place their primary swatch). `createLightTheme` /
 * `createDarkTheme` derive every `colorBrand*` / `colorCompoundBrand*`
 * semantic token from this ramp on top of the same base structure as
 * `webLightTheme` / `webDarkTheme` — this *is* Fluent's documented
 * brand-token override mechanism, not a parallel token system.
 */
const draghubBrandRamp: BrandVariants = {
  10: "#151C08",
  20: "#24320C",
  30: "#34490E",
  40: "#48660F",
  50: "#5F8A0F",
  60: "#76AF0E",
  70: "#91D70F",
  80: "#A7F11E",
  90: "#B8F34A",
  100: "#C2F368",
  110: "#CDF288",
  120: "#D7F1A7",
  130: "#E2F1C6",
  140: "#EBF2DE",
  150: "#F3F6EF",
  160: "#FAFBF9",
};

export const draghubLightTheme: Theme = createLightTheme(draghubBrandRamp);
export const draghubDarkTheme: Theme = createDarkTheme(draghubBrandRamp);

import type { SVGProps } from "react";
import { SpinnerIosRegular } from "./fluent-icons";

/** A spinning loading indicator built from a Fluent icon + CSS animation
 * (Fluent's icon set ships static glyphs only, no built-in spinner
 * animation). Drop-in replacement for the old hand-drawn Spinner. */
export function Spinner(props: SVGProps<SVGSVGElement>) {
  const { className, ...rest } = props;
  return (
    <SpinnerIosRegular
      className={`animate-spin ${className ?? ""}`}
      {...rest}
    />
  );
}

import localFont from "next/font/local";

export const inter = localFont({
  src: [
    { path: "../public/fonts/Inter-VariableFont_slnt,wght.ttf", style: "normal" },
    { path: "../public/fonts/Inter-Italic-VariableFont_slnt,wght.ttf", style: "italic" },
  ],
  display: "swap",
  preload: true,
});

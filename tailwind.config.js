/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}"
  ],
  theme: { extend: {} },
  safelist: [
    // Keep only what you truly use; these are safe and quiet
    { pattern: /backdrop-blur(|-sm|-md|-lg|-xl|-2xl)?/ }
  ],
  plugins: []
};

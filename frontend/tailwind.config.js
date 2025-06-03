/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        ubuntuMono: ["'Ubuntu Mono'", "monospace"],
        ubuntuSansMono: ["'Ubuntu Sans Mono'", "monospace"],
      },
    },
  },
  plugins: [],
  safelist: [
    'h-[30rem]',
    'h-[23rem]',
  ],
};
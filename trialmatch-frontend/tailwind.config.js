/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 24px 80px rgba(15, 23, 42, 0.16)",
        glow: "0 0 80px rgba(37, 99, 235, 0.22)",
      },
    },
  },
  plugins: [],
};

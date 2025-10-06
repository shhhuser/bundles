/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0f14",
        neon: { lime: "#14f195", violet: "#8d7aff", cyan: "#2fd0ff" }
      },
      borderRadius: { '2xl': '1.25rem' }
    }
  },
  plugins: []
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2E86DE",
          50: "#EBF4FF",
          100: "#C3DFFE",
          200: "#9BC9FD",
          300: "#72B4FC",
          400: "#4A9EFB",
          500: "#2E86DE",
          600: "#1A6DBF",
          700: "#0D539F",
          800: "#073A80",
          900: "#032160",
        },
        secondary: {
          DEFAULT: "#58D68D",
          50: "#EDFAF4",
          100: "#C8F0DB",
          200: "#A3E6C3",
          300: "#7EDCAA",
          400: "#58D68D",
          500: "#33CE70",
          600: "#20B05A",
          700: "#178D47",
          800: "#0E6A35",
          900: "#064722",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Sora", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 15px rgba(0,0,0,0.06)",
        "card-hover": "0 8px 30px rgba(46,134,222,0.15)",
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontFamily: {
      display: ["Poppins", "sans-serif"],
    },

    extend: {
      // Colors used in the project
      colors: {
        primary: "#05B6D3",
        secondary: "#EF863E",
      },
      backgroundImage: {
        'login-bg-img': "url('./src/assets/images/bg-login-image.jpg')",
        'signup-bg-img': "url('./src/assets/images/signup-bg-image.jpg')",
      }
    },
  },
  plugins: [],
}


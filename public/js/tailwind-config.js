tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#a78bfa",
          400: "#a855f7",
          500: "#7c4dff", // Updated to VI Primary
          600: "#6d28d9",
          700: "#5b21b6",
          800: "#4c1d95",
          900: "#2e1065"
        },
        // VI System Colors
        vi: {
          primary: '#7C4DFF',   // Main Purple
          secondary: '#AA00FF', // Magenta/Secondary
          accent: '#FFB300',    // Amber/Yellow
          highlight: '#EA5504', // Orange
          cyan: '#26C6DA',      // Cyan/Teal
          text: {
            main: '#242424',    // Title Text
            body: '#757575',    // Body Text
            light: '#BDBDBD',   // Hint/Disabled Text
            disabled: '#E0E0E0' // Borders/Dividers
          },
          bg: {
            page: '#F5F7F9',    // Light Blue-Grey Background
            card: '#FFFFFF',    // White
            table: '#F2F2F2',   // Table Header
            hover: '#F8F8F8'    // Row Hover
          },
          border: {
            DEFAULT: '#DDDDDD',
            light: '#E1E1E1'
          }
        },
        // Legacy/Semantic mapping
        primary: {
          DEFAULT: '#7C4DFF', 
          hover: '#AA00FF',   // Use Secondary for hover
          light: '#d8b4fe',
          dark: '#5e35b1',
        },
        dark: {
          DEFAULT: '#0f0529',
          lighter: '#1a0b3b',
          deeper: '#2d1b5e',
        },
        slate: { 
          50: "#F5F7F9", // Override slate-50 to VI Page BG
          100: "#F2F2F2",
          200: "#E5E5E5",
          300: "#E0E0E0",
          400: "#BDBDBD",
          500: "#9E9E9E",
          600: "#757575", // VI Body Text
          700: "#616161",
          800: "#424242",
          850: "#303030",
          900: "#242424"  // VI Main Text
        }
      },
      fontFamily: { 
        sans: ['"MiSansNumbers"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"],
        mono: ['"MiSansNumbers"', "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", '"Liberation Mono"', '"Courier New"', "monospace"]
      },
      backgroundImage: { "grid-pattern": "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23f1f5f9' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")" }
    }
  }
};

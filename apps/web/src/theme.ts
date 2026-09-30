import { createTheme, type MantineColorsTuple } from "@mantine/core";

const brandBlue: MantineColorsTuple = [
  "#EFF4FF",
  "#DBEAFE",
  "#BFDBFE",
  "#93C5FD",
  "#60A5FA",
  "#3B82F6",
  "#2563EB",
  "#1D4ED8",
  "#1E40AF",
  "#1E3A8A",
];

export const theme = createTheme({
  primaryColor: "brandBlue",
  colors: {
    brandBlue,
  },
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSizes: {
    xs: "14px",
    sm: "16px",
    md: "16px",
    lg: "18px",
    xl: "20px",
  },
  defaultRadius: "sm",
  radius: {
    xs: "4px",
    sm: "6px",
    md: "8px",
    lg: "8px",
    xl: "8px",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
  },
  components: {
    Button: {
      defaultProps: {
        size: "md",
      },
    },
    TextInput: {
      defaultProps: {
        size: "md",
      },
    },
  },
});

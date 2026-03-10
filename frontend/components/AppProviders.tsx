"use client";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline, GlobalStyles, ThemeProvider, createTheme } from "@mui/material";
import type { ReactNode } from "react";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0f8a5f",
      light: "#39a77e",
      dark: "#086646",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#2878a5",
      light: "#5e9cc1",
      dark: "#1a5a7c",
    },
    background: {
      default: "#f3f6f4",
      paper: "#ffffff",
    },
    text: {
      primary: "#10231c",
      secondary: "#587066",
    },
    divider: "#d8e2dc",
    success: {
      main: "#0f8a5f",
    },
    warning: {
      main: "#f0a202",
    },
    error: {
      main: "#d64545",
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    h3: {
      fontWeight: 700,
      letterSpacing: -0.8,
    },
    h4: {
      fontWeight: 700,
      letterSpacing: -0.6,
    },
    h5: {
      fontWeight: 700,
      letterSpacing: -0.3,
    },
    h6: {
      fontWeight: 700,
    },
    subtitle1: {
      fontSize: "1rem",
      lineHeight: 1.6,
    },
    body1: {
      lineHeight: 1.7,
    },
    body2: {
      lineHeight: 1.6,
    },
    button: {
      fontWeight: 600,
      textTransform: "none",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: "radial-gradient(circle at top left, #f7fbf8 0%, #f3f6f4 55%, #eef3f0 100%)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "0 14px 34px rgba(16, 35, 28, 0.05)",
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #d8e2dc",
          borderRadius: 28,
          boxShadow: "0 10px 24px rgba(16, 35, 28, 0.045)",
          backgroundImage: "none",
          overflow: "hidden",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18,
          paddingBlock: 10,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          backgroundColor: "#fbfdfc",
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          textTransform: "none",
        },
      },
    },
  },
});

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles
          styles={{
            "*": {
              boxSizing: "border-box",
            },
            a: {
              color: "inherit",
              textDecoration: "none",
            },
          }}
        />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
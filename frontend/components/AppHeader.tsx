"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import CircleIcon from "@mui/icons-material/Circle";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LocalHospitalRoundedIcon from "@mui/icons-material/LocalHospitalRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";

const navItems = [
  { href: "/simulator", label: "Simulator", icon: <ScienceRoundedIcon /> },
  { href: "/dashboard", label: "Dashboard", icon: <LocalHospitalRoundedIcon /> },
  { href: "/feedback", label: "Feedback", icon: <RateReviewRoundedIcon /> },
  { href: "/tickets", label: "Tickets", icon: <ReceiptLongRoundedIcon /> },
  { href: "/heatmap", label: "Heatmap", icon: <MapRoundedIcon /> },
  { href: "/analytics", label: "Analytics", icon: <InsightsRoundedIcon /> },
  { href: "/notifications", label: "Alerts", icon: <NotificationsNoneRoundedIcon /> },
];

export default function AppHeader() {
  const pathname = usePathname();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const rawUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
    const wsUrl = /\/ws$/i.test(rawUrl) ? rawUrl : `${rawUrl.replace(/\/$/, "")}/ws`;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    return () => ws.close();
  }, []);

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      className="shell-enter"
      sx={{
        top: 0,
        borderBottom: "1px solid",
        borderColor: "divider",
        backdropFilter: "blur(18px)",
        backgroundColor: "rgba(247, 251, 248, 0.82)",
      }}
    >
      <Toolbar sx={{ px: { xs: 2, md: 3 }, py: 1.75 }}>
        <Box sx={{ width: "100%", maxWidth: 1280, mx: "auto" }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={2.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", lg: "center" }}
            >
              <Stack direction="row" spacing={1.75} alignItems="center">
                <Avatar sx={{ bgcolor: "primary.main", width: 44, height: 44 }}>
                  <FavoriteBorderRoundedIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontSize: { xs: 20, md: 22 }, lineHeight: 1.05 }}>
                    Recovery Agent
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Hospital AI Operations Console
                  </Typography>
                </Box>
              </Stack>

              <Button
                variant="outlined"
                color={connected ? "success" : "error"}
                startIcon={<CircleIcon sx={{ fontSize: "0.75rem !important" }} />}
                sx={{
                  borderRadius: 999,
                  minWidth: 112,
                  bgcolor: "background.paper",
                  pointerEvents: "none",
                }}
              >
                {connected ? "Live" : "Offline"}
              </Button>
            </Stack>

            <Box sx={{ display: "flex", justifyContent: { xs: "flex-start", md: "center" } }}>
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  overflowX: "auto",
                  pb: 0.5,
                  pt: 0.25,
                  px: 0.75,
                  maxWidth: "100%",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 999,
                  bgcolor: "rgba(255, 255, 255, 0.92)",
                  boxShadow: "0 14px 28px rgba(16, 35, 28, 0.05)",
                  scrollbarWidth: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                }}
              >
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Button
                      key={item.href}
                      component={Link}
                      href={item.href}
                      startIcon={item.icon}
                      className="nav-pill"
                      sx={{
                        flexShrink: 0,
                        borderRadius: 999,
                        px: 1.85,
                        py: 0.95,
                        color: active ? "primary.dark" : "text.primary",
                        bgcolor: active ? "rgba(15, 138, 95, 0.14)" : "transparent",
                        border: "1px solid",
                        borderColor: active ? "rgba(15, 138, 95, 0.24)" : "transparent",
                        boxShadow: active ? "0 10px 24px rgba(15, 138, 95, 0.12)" : "none",
                        whiteSpace: "nowrap",
                        "&:hover": {
                          bgcolor: active ? "rgba(15, 138, 95, 0.18)" : "rgba(247, 251, 248, 0.96)",
                          transform: "translateY(-1px)",
                        },
                      }}
                    >
                      {item.label}
                    </Button>
                  );
                })}
              </Box>
            </Box>
          </Stack>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LocalHospitalRoundedIcon from "@mui/icons-material/LocalHospitalRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import {
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";

const navItems = [
  { href: "/simulator", label: "Patient Simulator", icon: <ScienceRoundedIcon /> },
  { href: "/dashboard", label: "Dashboard", icon: <LocalHospitalRoundedIcon /> },
  { href: "/feedback", label: "Feedback Monitor", icon: <RateReviewRoundedIcon /> },
  { href: "/tickets", label: "Complaint Tickets", icon: <ReceiptLongRoundedIcon /> },
  { href: "/heatmap", label: "Department Heatmap", icon: <MapRoundedIcon /> },
  { href: "/analytics", label: "Analytics", icon: <InsightsRoundedIcon /> },
  { href: "/notifications", label: "Notifications", icon: <NotificationsNoneRoundedIcon /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 288,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: 288,
          boxSizing: "border-box",
        },
      }}
    >
        <Toolbar sx={{ px: 3, py: 2.5, minHeight: "88px !important" }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>
              <FavoriteBorderRoundedIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontSize: 22, lineHeight: 1.1 }}>
                Recovery Agent
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Hospital AI System
              </Typography>
            </Box>
          </Stack>
        </Toolbar>

        <Divider />

        <Box sx={{ px: 2, py: 2, flex: 1 }}>
          <List disablePadding>
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Tooltip key={item.href} title={item.label} placement="right">
                  <ListItemButton
                    component={Link}
                    href={item.href}
                    selected={active}
                    sx={{
                      px: 2,
                      color: active ? "primary.main" : "text.primary",
                      bgcolor: active ? "rgba(15, 138, 95, 0.10)" : "transparent",
                      "&.Mui-selected": {
                        bgcolor: "rgba(15, 138, 95, 0.12)",
                      },
                      "&.Mui-selected:hover": {
                        bgcolor: "rgba(15, 138, 95, 0.16)",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 44,
                        color: active ? "primary.main" : "text.secondary",
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontWeight: active ? 700 : 600,
                        fontSize: 15,
                      }}
                    />
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </List>
        </Box>

        <Box sx={{ p: 2.5 }}>
          <Chip label="GlitchCon 2.0 • GKM_3" color="primary" variant="outlined" />
        </Box>
    </Drawer>
  );
}
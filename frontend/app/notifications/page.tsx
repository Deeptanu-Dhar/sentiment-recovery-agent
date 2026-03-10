"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import TopBar from "@/components/TopBar";
import { getNotifications, markAllRead, markNotificationRead } from "@/lib/api";
import { stripDecorativeText } from "@/lib/text";

const urgencyStyles: Record<string, { border: string; bg: string; chipBg: string; chipColor: string }> = {
  critical: { border: "#d64545", bg: "#fff0f0", chipBg: "#ffe8e8", chipColor: "#d64545" },
  high: { border: "#f0a202", bg: "#fff8e8", chipBg: "#fff5db", chipColor: "#b87800" },
  medium: { border: "#2b6f8f", bg: "#eff7fb", chipBg: "#e6f2f7", chipColor: "#2b6f8f" },
  low: { border: "#7d9188", bg: "#f5f7f6", chipBg: "#edf1ef", chipColor: "#587066" },
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => getNotifications().then(setNotifs).catch(console.error).finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleRead = async (id: string) => {
    await markNotificationRead(id);
    load();
  };

  const handleReadAll = async () => {
    await markAllRead();
    load();
  };

  const unread = notifs.filter((notification) => !notification.isRead).length;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <TopBar title="Manager Notifications" subtitle="Critical alerts routed to the duty management team with urgency, timestamps, and read controls." />

      <Box sx={{ maxWidth: 1100, mx: "auto" }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 4 }}>
          <Typography variant="subtitle1" color="text.secondary">
            All Alerts ({notifs.length}) • <Box component="span" sx={{ color: "primary.main", fontWeight: 700 }}>{unread} unread</Box>
          </Typography>

          {unread > 0 && (
            <Button variant="outlined" onClick={handleReadAll} sx={{ alignSelf: { xs: "flex-start", md: "center" } }}>
              Mark All Read
            </Button>
          )}
        </Stack>

        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
            <CircularProgress color="primary" />
          </Stack>
        ) : notifs.length === 0 ? (
          <Card>
            <CardContent sx={{ p: 6, textAlign: "center" }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>No alerts yet</Typography>
              <Typography color="text.secondary">Critical complaints with severity of 4 or 5 will appear here automatically.</Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={3}>
            {notifs.map((notification) => {
              const urgency = urgencyStyles[notification.urgency] || urgencyStyles.low;
              const cleanTitle = stripDecorativeText(notification.title);
              const cleanMessage = stripDecorativeText(notification.message);

              return (
                <Card
                  key={notification._id}
                  sx={{
                    borderLeft: `6px solid ${urgency.border}`,
                    bgcolor: urgency.bg,
                    opacity: notification.isRead ? 0.76 : 1,
                  }}
                >
                  <CardContent sx={{ p: 3.5 }}>
                    <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={3}>
                      <Stack spacing={1.5} sx={{ flex: 1, maxWidth: 820 }}>
                        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap alignItems="center">
                          {!notification.isRead && (
                            <Box sx={{ width: 10, height: 10, borderRadius: 999, bgcolor: "primary.main" }} />
                          )}
                          <Typography variant="h6">{cleanTitle}</Typography>
                          <Chip
                            label={notification.urgency}
                            sx={{
                              bgcolor: urgency.chipBg,
                              color: urgency.chipColor,
                            }}
                          />
                        </Stack>

                        <Typography variant="body1" color="text.secondary">
                          {cleanMessage}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(notification.createdAt).toLocaleString()}
                        </Typography>
                      </Stack>

                      {!notification.isRead && (
                        <Button variant="outlined" onClick={() => handleRead(notification._id)} sx={{ alignSelf: { xs: "flex-start", lg: "center" } }}>
                          Mark Read
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
"use client";

import { useEffect, useState } from "react";
import { Box, Card, CardContent, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import TopBar from "@/components/TopBar";
import { getHeatmap } from "@/lib/api";

const riskConfig: Record<string, { bg: string; color: string; border: string }> = {
  None: { bg: "#f6f8f7", color: "#587066", border: "#d8e2dc" },
  Low: { bg: "#e7f6ef", color: "#0f8a5f", border: "#b9dfcf" },
  Medium: { bg: "#fff5db", color: "#b87800", border: "#f0db9c" },
  High: { bg: "#fff0df", color: "#c87500", border: "#f0c58e" },
  Critical: { bg: "#ffe8e8", color: "#d64545", border: "#f0b8b8" },
};

export default function HeatmapPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHeatmap().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ maxWidth: 1180, mx: "auto" }}>
      <TopBar title="Department Heatmap" subtitle="Complaint risk intensity by department so you can see where service recovery needs attention first." />

      <Box sx={{ maxWidth: 1180, mx: "auto" }}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 4 }} justifyContent={{ xs: "flex-start", md: "center" }}>
          {Object.keys(riskConfig).map((level) => (
            <Chip key={level} label={level} variant="outlined" />
          ))}
        </Stack>

        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
            <CircularProgress color="primary" />
          </Stack>
        ) : data.length === 0 ? (
          <Card>
            <CardContent sx={{ p: 6, textAlign: "center" }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>No department data yet</Typography>
              <Typography color="text.secondary">Submit patient feedback first to generate the departmental heatmap.</Typography>
            </CardContent>
          </Card>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" },
              gap: 3,
            }}
          >
            {data.map((item) => {
              const risk = riskConfig[item.riskLevel] || riskConfig.None;

              return (
                <Card key={item.department} sx={{ bgcolor: risk.bg, borderColor: risk.border }}>
                  <CardContent sx={{ p: 3.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                      <Typography variant="h6">{item.department}</Typography>
                      <Chip label={item.riskLevel} sx={{ bgcolor: "rgba(255,255,255,0.55)", color: risk.color }} />
                    </Stack>

                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 2,
                      }}
                    >
                      {[
                        { label: "Total", value: item.totalFeedback, color: "text.primary" },
                        { label: "Negative", value: item.negativeCount, color: "error.main" },
                        { label: "Avg Sev", value: item.avgSeverity, color: "text.primary" },
                      ].map((stat) => (
                        <Box
                          key={stat.label}
                          sx={{
                            textAlign: "center",
                            bgcolor: "rgba(255,255,255,0.72)",
                            borderRadius: 4,
                            py: 2.25,
                            px: 1,
                          }}
                        >
                          <Typography variant="h5" sx={{ color: stat.color, mb: 0.5 }}>
                            {stat.value}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {stat.label}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}
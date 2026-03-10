"use client";

import { useEffect, useState } from "react";
import { Box, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import TopBar from "@/components/TopBar";
import { getSummary } from "@/lib/api";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => getSummary().then(setData).catch(console.error).finally(() => setLoading(false));

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: "Total Feedback", value: data?.totalFeedback ?? 0, tone: "#e7f6ef", color: "#0f8a5f" },
    { label: "Open Tickets", value: data?.openTickets ?? 0, tone: "#fff5db", color: "#b87800" },
    { label: "Critical Alerts", value: data?.criticalAlerts ?? 0, tone: "#ffe8e8", color: "#d64545" },
    { label: "Avg Severity", value: data?.avgSeverity ?? "—", tone: "#eef1ff", color: "#5563d6" },
  ];

  const sentimentChartData = Object.entries(data?.sentimentDistribution || {}).map(([name, value]) => ({
    name,
    value: Number(value),
  }));

  const categoryChartData = (data?.topCategories || []).map((category: any) => ({
    name: category.category,
    count: Number(category.count),
  }));

  const chartColors = ["#0f8a5f", "#d64545", "#f0a202", "#2878a5"];

  return (
    <Box sx={{ maxWidth: 1180, mx: "auto" }}>
      <TopBar title="Command Dashboard" subtitle="Real-time hospital sentiment signals, complaints, and escalation trends in one place." />

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
          <CircularProgress color="primary" />
        </Stack>
      ) : (
        <Stack spacing={4}>
          <Card
            sx={{
              background: "linear-gradient(135deg, rgba(15,138,95,0.12) 0%, rgba(255,255,255,0.96) 58%, rgba(40,120,165,0.12) 100%)",
            }}
          >
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.25fr) minmax(320px, 0.75fr)" },
                  gap: 3,
                  alignItems: "center",
                }}
              >
                <Stack spacing={1.5}>
                  <Typography variant="h4" sx={{ maxWidth: 620 }}>
                    Operational Snapshot
                  </Typography>
                  <Typography color="text.secondary" sx={{ maxWidth: 640 }}>
                    Live metrics for patient sentiment, unresolved tickets, and urgent service recovery activity.
                  </Typography>
                </Stack>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 1.5,
                  }}
                >
                  {stats.map((item) => (
                    <Box
                      key={item.label}
                      sx={{
                        p: 2,
                        borderRadius: 4,
                        bgcolor: "rgba(255,255,255,0.82)",
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {item.label}
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 0.75, color: item.color }}>
                        {item.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" },
              gap: 3,
            }}
          >
            {stats.map((item) => (
              <Card key={item.label} sx={{ bgcolor: item.tone, minHeight: 170 }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Typography variant="h4" sx={{ color: item.color, mb: 1, fontSize: 38 }}>
                    {item.value}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ color: item.color, fontWeight: 600 }}>
                    {item.label}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" },
              gap: 4,
              alignItems: "start",
            }}
          >
            <Card sx={{ height: "100%" }}>
              <CardContent sx={{ p: 3.5 }}>
                <Typography variant="h5" sx={{ mb: 1 }}>
                  Sentiment Distribution
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Clearer sentiment proportions help teams prioritize recovery attention quickly.
                </Typography>

                {sentimentChartData.length > 0 ? (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "280px minmax(0, 1fr)" },
                      gap: 2,
                      alignItems: "center",
                    }}
                  >
                    <Box sx={{ width: "100%", height: 260 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={sentimentChartData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={4}>
                            {sentimentChartData.map((entry, index) => (
                              <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>

                    <Stack spacing={1.5}>
                      {sentimentChartData.map((item, index) => {
                        const total = sentimentChartData.reduce((sum, point) => sum + Number(point.value || 0), 0);
                        const pct = total ? Math.round((Number(item.value) / total) * 100) : 0;
                        return (
                          <Box key={item.name} sx={{ p: 2, borderRadius: 4, bgcolor: "#f8fbf9", border: "1px solid", borderColor: "divider" }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Stack direction="row" spacing={1.25} alignItems="center">
                                <Box sx={{ width: 12, height: 12, borderRadius: 999, bgcolor: chartColors[index % chartColors.length] }} />
                                <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                              </Stack>
                              <Typography color="text.secondary">
                                {item.value} ({pct}%)
                              </Typography>
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                ) : (
                  <Typography color="text.secondary">No data yet. Submit feedback first.</Typography>
                )}
              </CardContent>
            </Card>

            <Card sx={{ height: "100%" }}>
              <CardContent sx={{ p: 3.5 }}>
                <Typography variant="h5" sx={{ mb: 1 }}>
                  Top Complaint Categories
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Category volume is presented as a proper chart to improve at-a-glance risk detection.
                </Typography>

                {categoryChartData.length > 0 ? (
                  <Box sx={{ width: "100%", height: 320 }}>
                    <ResponsiveContainer>
                      <BarChart data={categoryChartData} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4ece8" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={110} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: "rgba(15,138,95,0.06)" }} />
                        <Bar dataKey="count" radius={[0, 10, 10, 0]} fill="#0f8a5f" barSize={26} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                ) : (
                  <Typography color="text.secondary">No complaints yet.</Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
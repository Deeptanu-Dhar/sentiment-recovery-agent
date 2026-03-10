"use client";

import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
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
import { getWeeklyReport } from "@/lib/api";

export default function AnalyticsPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getWeeklyReport();
      setReport(data);
    } catch {
      setError("Failed to generate report. Make sure backend is running.");
    }
    setLoading(false);
  };

  const sentimentChartData = Object.entries(report?.sentimentBreakdown || {}).map(([name, value]) => ({
    name,
    value: Number(value),
  }));

  const categoryChartData = (report?.topComplaintCategories || []).map((category: any) => ({
    name: category.category,
    count: Number(category.count),
  }));

  const chartColors = ["#0f8a5f", "#d64545", "#f0a202", "#2878a5"];

  return (
    <Box sx={{ maxWidth: 1180, mx: "auto" }}>
      <TopBar title="Analytics Report" subtitle="Weekly trends, department patterns, and performance insight generated from the last seven days of patient feedback." />

      {!report && !loading && (
        <Card sx={{ maxWidth: 920, mx: "auto" }}>
          <CardContent sx={{ p: 6, textAlign: "center" }}>
            <Stack spacing={3} alignItems="center">
              <Typography variant="h5">Generate Weekly Report</Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 560 }}>
                Gemini will analyze all feedback received in the past 7 days and produce a structured report with risk areas and recommended actions.
              </Typography>
              <Button variant="contained" size="large" onClick={load}>
                Generate Report
              </Button>
              {error && <Alert severity="error" sx={{ width: "100%", maxWidth: 560 }}>{error}</Alert>}
            </Stack>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card sx={{ maxWidth: 920, mx: "auto" }}>
          <CardContent sx={{ p: 6, textAlign: "center" }}>
            <Stack spacing={3} alignItems="center">
              <CircularProgress color="primary" />
              <Typography variant="h6">Gemini analyzing weekly data...</Typography>
              <Typography color="text.secondary">This may take a few seconds.</Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {report && !loading && (
        <Stack spacing={4} sx={{ maxWidth: 1180, mx: "auto" }}>
          <Card
            sx={{
              background: "linear-gradient(135deg, rgba(40,120,165,0.12) 0%, rgba(255,255,255,0.96) 50%, rgba(15,138,95,0.10) 100%)",
            }}
          >
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.2fr) minmax(300px, 0.8fr)" },
                  gap: 3,
                  alignItems: "center",
                }}
              >
                <Stack spacing={1.5}>
                  <Typography variant="h4" sx={{ maxWidth: 640 }}>
                    Weekly Analysis Report
                  </Typography>
                  <Typography color="text.secondary" sx={{ maxWidth: 660 }}>
                    {report.overallInsight}
                  </Typography>
                </Stack>

                <Stack spacing={1.25}>
                  {(report.recommendedActions || []).slice(0, 3).map((action: string, index: number) => (
                    <Box key={index} sx={{ p: 2, borderRadius: 4, bgcolor: "rgba(255,255,255,0.84)", border: "1px solid", borderColor: "divider" }}>
                      <Typography variant="body2" color="text.secondary">Recommended action {index + 1}</Typography>
                      <Typography sx={{ mt: 0.5, fontWeight: 600 }}>{action}</Typography>
                    </Box>
                  ))}
                </Stack>
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
            {[
              { label: "Total Feedback", value: report.totalFeedback, tone: "#e7f6ef", color: "#0f8a5f" },
              { label: "Avg Severity", value: report.avgSeverity, tone: "#fff5db", color: "#b87800" },
              { label: "Resolution Rate", value: `${Math.round((report.resolutionRate || 0) * 100)}%`, tone: "#ebf6fb", color: "#2878a5" },
              { label: "SLA Breaches", value: report.slaBreachCount, tone: "#ffe8e8", color: "#d64545" },
            ].map((item) => (
              <Card key={item.label} sx={{ bgcolor: item.tone, minHeight: 160 }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Typography variant="h4" sx={{ color: item.color, mb: 1.25, fontSize: 38 }}>
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
            }}
          >
            <Card>
              <CardContent sx={{ p: 3.5 }}>
                <Typography variant="h5" sx={{ mb: 1 }}>Sentiment Breakdown</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  The weekly emotional mix is easier to read as a chart than as isolated figures.
                </Typography>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "260px minmax(0, 1fr)" },
                    gap: 2,
                    alignItems: "center",
                  }}
                >
                  <Box sx={{ width: "100%", height: 250 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={sentimentChartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={4}>
                          {sentimentChartData.map((entry, index) => (
                            <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>

                  <Stack spacing={1.5}>
                    {sentimentChartData.map((item, index) => (
                      <Box key={item.name} sx={{ p: 2, borderRadius: 4, bgcolor: "#f8fbf9", border: "1px solid", borderColor: "divider" }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Box sx={{ width: 12, height: 12, borderRadius: 999, bgcolor: chartColors[index % chartColors.length] }} />
                            <Typography sx={{ fontWeight: 700, textTransform: "capitalize" }}>{item.name}</Typography>
                          </Stack>
                          <Typography color="text.secondary">{item.value}</Typography>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: 3.5 }}>
                <Typography variant="h5" sx={{ mb: 1 }}>Top Complaint Categories</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Volume is plotted horizontally to make dominant issue areas obvious.
                </Typography>

                <Box sx={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={categoryChartData} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4ece8" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={122} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: "rgba(15,138,95,0.06)" }} />
                      <Bar dataKey="count" radius={[0, 10, 10, 0]} fill="#2878a5" barSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Box>

          <Card>
            <CardContent sx={{ p: 3.5 }}>
              <Typography variant="h5" sx={{ mb: 2 }}>AI Insight and Actions</Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(300px, 420px)" },
                  gap: 3,
                }}
              >
                <Box sx={{ p: 2.5, borderRadius: 4, bgcolor: "#f8fbf9", border: "1px solid", borderColor: "divider" }}>
                  <Typography variant="body1">{report.overallInsight}</Typography>
                </Box>
                <Stack spacing={1.5}>
                  {report.recommendedActions?.map((action: string, index: number) => (
                    <Box key={index} sx={{ p: 2, borderRadius: 4, bgcolor: "rgba(15, 138, 95, 0.08)", borderLeft: "4px solid #0f8a5f" }}>
                      <Typography variant="body2" color="text.secondary">Action {index + 1}</Typography>
                      <Typography sx={{ mt: 0.5, fontWeight: 600 }}>{action}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </CardContent>
          </Card>

          <Button variant="outlined" onClick={load} sx={{ alignSelf: "flex-start" }}>
            Regenerate Report
          </Button>
        </Stack>
      )}
    </Box>
  );
}
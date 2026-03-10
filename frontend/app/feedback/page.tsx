"use client";

import { useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import TopBar from "@/components/TopBar";
import { getFeedbacks } from "@/lib/api";

const sentimentStyles: Record<string, { color: string; bg: string; border: string }> = {
  Positive: { color: "#0f8a5f", bg: "#e7f6ef", border: "#b9dfcf" },
  Negative: { color: "#d64545", bg: "#ffe8e8", border: "#f0b8b8" },
  Neutral: { color: "#b87800", bg: "#fff5db", border: "#f0db9c" },
};

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeedbacks().then(setFeedbacks).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ maxWidth: 1120, mx: "auto" }}>
      <TopBar title="Feedback Monitor" subtitle="Patient comments, AI classification, and personalized recovery messages in a single review stream." />

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
          <CircularProgress color="primary" />
        </Stack>
      ) : feedbacks.length === 0 ? (
        <Card sx={{ maxWidth: 960, mx: "auto" }}>
          <CardContent sx={{ p: 6, textAlign: "center" }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>No feedback yet</Typography>
            <Typography color="text.secondary">Use the Patient Simulator to submit feedback and populate this view.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={3} sx={{ maxWidth: 1120, mx: "auto" }}>
          {feedbacks.map((item) => {
            const sentiment = sentimentStyles[item.sentiment] || { color: "#587066", bg: "#f6f8f7", border: "#d8e2dc" };

            return (
              <Card key={item._id}>
                <CardContent sx={{ p: 3.5 }}>
                  <Stack spacing={2.5}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} alignItems={{ xs: "flex-start", md: "flex-start" }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ width: 52, height: 52, bgcolor: "rgba(15, 138, 95, 0.12)", color: "primary.main", fontWeight: 700 }}>
                          {item.patientName?.[0] || "P"}
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ mb: 0.5 }}>{item.patientName}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.patientId} • {item.department} • {new Date(item.submittedAt).toLocaleString()}
                          </Typography>
                        </Box>
                      </Stack>

                      <Chip
                        label={item.sentiment}
                        variant="outlined"
                        sx={{
                          color: sentiment.color,
                          bgcolor: sentiment.bg,
                          borderColor: sentiment.border,
                        }}
                      />
                    </Stack>

                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: 4,
                        bgcolor: "#f8fbf9",
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="overline" color="text.secondary">
                        AI Summary
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.75, fontStyle: "italic", color: "text.primary" }}>
                        "{item.summary || item.rawText}"
                      </Typography>

                      {item.rawText && item.summary && item.rawText !== item.summary && (
                        <>
                          <Typography variant="overline" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                            Original Feedback
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                            "{item.rawText}"
                          </Typography>
                        </>
                      )}
                    </Box>

                    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                      <Chip label={item.category} variant="outlined" />
                      <Chip label={`Severity ${item.severity}/5`} variant="outlined" />
                      {item.complaintEntities?.map((entity: string, index: number) => (
                        <Chip
                          key={`${entity}-${index}`}
                          label={entity}
                          sx={{ bgcolor: "rgba(15, 138, 95, 0.10)", color: "primary.main" }}
                        />
                      ))}
                    </Stack>

                    {item.resolutionMessage && (
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 4,
                          bgcolor: "rgba(15, 138, 95, 0.08)",
                          borderLeft: "4px solid #0f8a5f",
                        }}
                      >
                        <Typography variant="body1" sx={{ fontStyle: "italic" }}>
                          {item.resolutionMessage}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
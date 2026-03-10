"use client";

import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import TopBar from "@/components/TopBar";
import { getPatientWorkflow, getPatients, updateBillingStatus } from "@/lib/api";

const FLOW_STEPS = [
  {
    title: "Select patient",
    description: "Choose the discharged patient whose recovery journey you want to simulate.",
    icon: PersonSearchRoundedIcon,
  },
  {
    title: "Confirm discharge",
    description: "Billing completion triggers the recovery workflow and post-discharge communication.",
    icon: FactCheckRoundedIcon,
  },
  {
    title: "Survey trigger",
    description: "The patient receives the feedback request through the configured outreach channel.",
    icon: CampaignRoundedIcon,
  },
  {
    title: "Capture feedback",
    description: "The simulator waits for the patient's WhatsApp reply and then pulls that response into the analysis pipeline.",
    icon: RateReviewRoundedIcon,
  },
  {
    title: "AI analysis",
    description: "Sentiment, severity, ticketing, escalation, and response actions are generated automatically.",
    icon: AutoAwesomeRoundedIcon,
  },
  {
    title: "Resolution outcome",
    description: "The system records actions taken and prepares the resolution message for the patient.",
    icon: CheckCircleRoundedIcon,
  },
] as const;

export default function SimulatorPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [workflow, setWorkflow] = useState<any>(null);
  const [log, setLog] = useState<string[]>([]);
  const workflowRef = useRef<any>(null);

  useEffect(() => {
    getPatients().then(setPatients).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selected || step < 3 || step >= 6) return;

    const intervalId = window.setInterval(() => {
      refreshWorkflow(true).catch(() => undefined);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [selected, step]);

  const addLog = (msg: string) =>
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const mapWorkflowResult = (payload: any) => {
    const feedback = payload?.latestFeedback;
    if (!feedback) return null;

    return {
      analysis: {
        sentiment: feedback.sentiment,
        sentimentScore: feedback.sentimentScore,
        severity: feedback.severity,
        category: feedback.category,
        complaintEntities: feedback.complaintEntities || [],
        summary: feedback.summary,
        resolutionMessage: feedback.resolutionMessage,
      },
      step3_ticketCreated: feedback.ticketId || null,
      step3_managerNotified: Boolean(feedback.managerNotified),
      step4_resolutionSent: Boolean(feedback.resolutionMessageSent),
      step5_reviewNudgeSent: Boolean(feedback.reviewNudgeSent),
    };
  };

  const syncWorkflowState = (payload: any) => {
    setWorkflow(payload);
    const previous = workflowRef.current;
    const patient = payload?.patient;
    const activeWorkflow = payload?.activeWorkflow;
    const twilioSurveyStatus = payload?.twilioSurveyStatus || activeWorkflow?.twilioSurveyStatus;
    const feedback = payload?.latestFeedback;

    if (activeWorkflow?.status === "survey_sent" && previous?.activeWorkflow?.runId !== activeWorkflow?.runId) {
      addLog(`Customized WhatsApp feedback request sent to ${patient.name} on ${patient.whatsappNumber || patient.phone}.`);
      setStep(4);
    }

    if (patient?.surveyResponse && previous?.patient?.surveyResponse !== patient.surveyResponse) {
      addLog(`Patient replied on WhatsApp: \"${patient.surveyResponse}\"`);
      setStep(5);
    }

    if (
      activeWorkflow?.status === "response_received" &&
      previous?.activeWorkflow?.status !== "response_received"
    ) {
      if (patient?.surveyResponse && previous?.patient?.surveyResponse === patient.surveyResponse) {
        addLog(`Patient replied on WhatsApp: \"${patient.surveyResponse}\"`);
      }
      setStep(5);
    }

    if (twilioSurveyStatus?.status && previous?.twilioSurveyStatus?.status !== twilioSurveyStatus.status) {
      addLog(`Twilio delivery status: ${twilioSurveyStatus.status}.`);
    }

    if (twilioSurveyStatus?.explanation && previous?.twilioSurveyStatus?.explanation !== twilioSurveyStatus.explanation) {
      addLog(`Twilio reported: ${twilioSurveyStatus.explanation}`);
    } else if (twilioSurveyStatus?.errorMessage && previous?.twilioSurveyStatus?.errorMessage !== twilioSurveyStatus.errorMessage) {
      addLog(`Twilio reported an error: ${twilioSurveyStatus.errorMessage}`);
    }

    if (feedback && feedback.workflowRunId === activeWorkflow?.runId) {
      const nextResult = mapWorkflowResult(payload);
      setResult(nextResult);
      if (previous?.latestFeedback?._id !== feedback._id) {
        addLog(`Analysis complete. Sentiment: ${feedback.sentiment}. Severity: ${feedback.severity}/5.`);
        addLog(`Complaint category identified as ${feedback.category}.`);
      }
      if (feedback.ticketId && previous?.latestFeedback?.ticketId !== feedback.ticketId) {
        addLog(`Ticket created: ${feedback.ticketId}.`);
      }
      if (feedback.managerNotified && !previous?.latestFeedback?.managerNotified) {
        addLog("Duty manager notified and SLA timer started.");
      }
      if (feedback.resolutionMessageSent && !previous?.latestFeedback?.resolutionMessageSent) {
        addLog("Gemini follow-up message sent back on WhatsApp.");
      }
      if (feedback.reviewNudgeSent && !previous?.latestFeedback?.reviewNudgeSent) {
        addLog("Positive thank-you follow-up sent on WhatsApp.");
      }
      setStep(6);
    }

    workflowRef.current = payload;
  };

  const refreshWorkflow = async (silent = false) => {
    if (!selected) return;
    const payload = await getPatientWorkflow(selected.patientId);
    syncWorkflowState(payload);
    if (!silent && payload?.activeWorkflow?.status === "survey_sent" && !payload?.patient?.surveyResponse) {
      addLog("Workflow refreshed. Waiting for the patient to reply on WhatsApp.");
    }
  };

  const handleSelectPatient = (p: any) => {
    setSelected(p);
    setPhoneInput(p.phone || "");
    setStep(2);
    setResult(null);
    setWorkflow(null);
    setLog([]);
    workflowRef.current = null;
    addLog(`Patient selected: ${p.name} (${p.patientId}) — ${p.department}`);
  };

  const handleDischarge = async () => {
    setLoading(true);
    addLog(`Marking ${selected.patientId} billing as Paid and sending WhatsApp survey...`);
    try {
      const response = await updateBillingStatus(selected.patientId, "Paid", phoneInput);
      addLog("Billing status updated to Paid.");
      addLog(`Twilio WhatsApp message queued for ${response.surveyPhone || phoneInput}.`);
      setStep(3);
      await refreshWorkflow();
    } catch (error: any) {
      addLog(error?.message || "Billing update failed.");
    }
    setLoading(false);
  };

  const handleReset = () => {
    setStep(1);
    setSelected(null);
    setPhoneInput("");
    setResult(null);
    setWorkflow(null);
    setLog([]);
    workflowRef.current = null;
  };

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === "Negative") return { color: "#d64545", bg: "#ffe8e8", border: "#f0b8b8" };
    if (sentiment === "Positive") return { color: "#0f8a5f", bg: "#e7f6ef", border: "#b9dfcf" };
    return { color: "#b87800", bg: "#fff5db", border: "#f0db9c" };
  };

  const getSeverityColor = (n: number) => {
    if (n >= 4) return "#d64545";
    if (n >= 3) return "#f0a202";
    if (n >= 2) return "#f6c453";
    return "#0f8a5f";
  };

  const timelineMessages = workflow?.patient?.whatsappMessages || [];
  const outcomeMessage = workflow?.patient?.lastResolutionMessage || workflow?.patient?.lastFollowUpMessage || null;
  const outcomeLabel = result?.step5_reviewNudgeSent ? "Thank-you Message Sent" : "Resolution Message Sent";
  const completedActions = [
    result?.step3_ticketCreated ? "CRM Ticket Created" : null,
    result?.step3_managerNotified ? "Duty Manager Notified (15-min SLA)" : null,
    result?.step4_resolutionSent ? "Personalized Resolution Message Sent" : null,
    result?.step5_reviewNudgeSent ? "WhatsApp Thank-you Follow-up Sent" : null,
  ].filter(Boolean) as string[];

  return (
    <Box sx={{ maxWidth: 1220, mx: "auto" }}>
      <TopBar title="Patient Simulator" subtitle="" />

      <Card
        sx={{
          mb: 4,
          background: "linear-gradient(135deg, rgba(15,138,95,0.12) 0%, rgba(255,255,255,0.96) 50%, rgba(40,120,165,0.10) 100%)",
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.2fr) minmax(320px, 0.8fr)" },
              gap: 3,
              alignItems: "center",
            }}
          >
            <Stack spacing={1.5}>
              <Typography variant="h4" sx={{ maxWidth: 640 }}>
                Workflow Overview
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 680 }}>
                Track the recovery flow from discharge to feedback, analysis, and resolution.
              </Typography>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 1.5,
              }}
            >
              {[
                { label: "Workflow", value: "6 steps" },
                { label: "Escalation SLA", value: "15 min" },
                { label: "Primary input", value: "Patient feedback" },
              ].map((item) => (
                <Box key={item.label} sx={{ p: 2, borderRadius: 4, bgcolor: "rgba(255,255,255,0.84)", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                  <Typography variant="h6" sx={{ mt: 0.75 }}>{item.value}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ mt: 4, display: { xs: "none", lg: "block" } }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                columnGap: 3,
                rowGap: 2.5,
                alignItems: "stretch",
              }}
            >
              {FLOW_STEPS.map((item, index) => {
                const Icon = item.icon;
                const active = step === index + 1;
                const completed = step > index + 1;
                const topRow = index % 2 === 1;
                const column = Math.floor(index / 2) + 1;
                const tone = completed || active ? "#0f8a5f" : "#8b9993";
                const surface = completed || active ? "rgba(231, 246, 239, 0.98)" : "rgba(255,255,255,0.86)";

                return (
                  <Box key={item.title} sx={{ gridColumn: column, gridRow: topRow ? 1 : 3, position: "relative" }}>
                    <Box
                      sx={{
                        p: 2.5,
                        minHeight: 188,
                        borderRadius: "28px",
                        bgcolor: surface,
                        border: "1px solid",
                        borderColor: completed || active ? "rgba(15,138,95,0.28)" : "divider",
                        boxShadow: completed || active ? "0 16px 28px rgba(15, 138, 95, 0.08)" : "0 10px 22px rgba(16, 35, 28, 0.03)",
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box sx={{ width: 46, height: 46, borderRadius: "16px", bgcolor: completed || active ? "rgba(15,138,95,0.12)" : "rgba(154,167,161,0.12)", color: tone, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon fontSize="small" />
                          </Box>
                          <Box sx={{ width: 34, height: 34, borderRadius: 999, bgcolor: completed || active ? "#0f8a5f" : "#9aa7a1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, boxShadow: active ? "0 0 0 6px rgba(15,138,95,0.14)" : "none" }}>
                            {index + 1}
                          </Box>
                        </Stack>
                        <Typography variant="h6" sx={{ fontSize: 21, maxWidth: 220 }}>
                          {item.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 240 }}>
                          {item.description}
                        </Typography>
                      </Stack>
                    </Box>

                    <Divider
                      orientation="vertical"
                      sx={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        top: topRow ? "100%" : -56,
                        height: 56,
                        borderColor: completed || active ? "rgba(15,138,95,0.28)" : "divider",
                        borderRightWidth: 2,
                      }}
                    />
                  </Box>
                );
              })}

              <Box sx={{ gridColumn: "1 / 4", gridRow: 2, position: "relative", height: 56 }}>
                <Box sx={{ position: "absolute", left: 0, right: 0, top: "50%", transform: "translateY(-50%)", height: 2, bgcolor: "#ccd7d2" }} />
                {FLOW_STEPS.map((item, index) => {
                  const active = step === index + 1;
                  const completed = step > index + 1;
                  const topRow = index % 2 === 1;
                  const column = Math.floor(index / 2);
                  const laneOffset = topRow ? 0.68 : 0.32;

                  return (
                    <Box
                      key={`${item.title}-node`}
                      sx={{
                        position: "absolute",
                        left: `calc(${((column + laneOffset) / 3) * 100}% - 17px)`,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        bgcolor: completed || active ? "#0f8a5f" : "#9aa7a1",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 14,
                        boxShadow: active ? "0 0 0 6px rgba(15,138,95,0.14)" : "none",
                      }}
                    >
                      {index + 1}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>

          <Stack spacing={2} sx={{ mt: 4, display: { xs: "flex", lg: "none" } }}>
            {FLOW_STEPS.map((item, index) => {
              const Icon = item.icon;
              const active = step === index + 1;
              const completed = step > index + 1;
              return (
                <Box key={item.title} sx={{ p: 2.25, borderRadius: 4, bgcolor: completed || active ? "rgba(231, 246, 239, 0.96)" : "rgba(255,255,255,0.82)", border: "1px solid", borderColor: completed || active ? "rgba(15,138,95,0.28)" : "divider" }}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box sx={{ width: 36, height: 36, borderRadius: 999, bgcolor: completed || active ? "#0f8a5f" : "#9aa7a1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon fontSize="small" />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.description}</Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.55fr) 340px" },
          gap: 3.5,
          alignItems: "start",
        }}
      >
        <Stack spacing={4} sx={{ minWidth: 0 }}>
          {step === 1 && (
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Stack spacing={3} sx={{ maxWidth: 980 }}>
                  <Box>
                    <Typography variant="h5" sx={{ mb: 1 }}>Step 1: Select a Patient</Typography>
                    <Typography color="text.secondary">Choose one of the seeded discharged patients to start the recovery flow.</Typography>
                  </Box>

                  {patients.length === 0 ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 180 }}>
                      <CircularProgress color="primary" />
                    </Stack>
                  ) : (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
                        gap: 2,
                      }}
                    >
                      {patients.map((patient) => (
                        <Card
                          key={patient.patientId}
                          variant="outlined"
                          sx={{
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            bgcolor: "#f8fbf9",
                            "&:hover": {
                              borderColor: "primary.main",
                              transform: "translateY(-2px)",
                            },
                          }}
                          onClick={() => handleSelectPatient(patient)}
                        >
                          <CardContent sx={{ p: 2.5 }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Avatar sx={{ bgcolor: "rgba(15, 138, 95, 0.12)", color: "primary.main", width: 48, height: 48 }}>
                                {patient.name[0]}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{patient.name}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {patient.patientId} • {patient.department}
                                </Typography>
                              </Box>
                            </Stack>
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {step === 2 && selected && (
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Stack spacing={3} sx={{ maxWidth: 920 }}>
                  <Box>
                    <Typography variant="h5" sx={{ mb: 1 }}>Step 2: Mark Billing as Paid</Typography>
                    <Typography color="text.secondary">This simulates discharge completion and triggers the automated survey workflow.</Typography>
                  </Box>

                  <Box sx={{ p: 3, borderRadius: 4, bgcolor: "#f8fbf9", border: "1px solid", borderColor: "divider" }}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
                        gap: 3,
                        alignItems: "center",
                      }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ width: 56, height: 56, bgcolor: "rgba(15, 138, 95, 0.12)", color: "primary.main" }}>
                          {selected.name[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="h6">{selected.name}</Typography>
                          <Typography variant="body2" color="text.secondary">{selected.patientId} • {selected.department}</Typography>
                          <Typography variant="body2" color="text.secondary">{selected.phone}</Typography>
                        </Box>
                      </Stack>

                      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap justifyContent={{ xs: "flex-start", md: "flex-end" }}>
                        <Chip label={`Current: ${selected.billingStatus || "Admitted"}`} color="warning" variant="outlined" />
                        <Typography color="text.secondary">→</Typography>
                        <Chip label="New: Paid" color="success" variant="outlined" />
                      </Stack>
                    </Box>
                  </Box>

                  <Typography variant="body1" color="text.secondary">
                    Once confirmed, the agent sends a customized WhatsApp message to the patient and then waits for the reply on that same chat.
                  </Typography>

                  <TextField
                    label="Patient WhatsApp number"
                    value={phoneInput}
                    onChange={(event) => setPhoneInput(event.target.value)}
                    placeholder="Enter a WhatsApp-enabled number with country code"
                    helperText="You can replace the seeded number here so Twilio sends the message to a real device."
                    fullWidth
                    sx={{ maxWidth: 520 }}
                  />

                  <Button variant="contained" size="large" onClick={handleDischarge} disabled={loading} sx={{ alignSelf: "flex-start", minWidth: { xs: "100%", sm: 320 } }}>
                    {loading ? "Processing..." : "Confirm Discharge & Trigger Survey"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardContent sx={{ p: 6, textAlign: "center" }}>
                <Stack spacing={2.5} alignItems="center">
                  <CircularProgress color="primary" />
                  <Typography variant="h5">Survey Sent</Typography>
                  <Typography color="text.secondary">Customized WhatsApp feedback request dispatched to {selected?.name}.</Typography>
                </Stack>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Stack spacing={3} sx={{ maxWidth: 980 }}>
                  <Box>
                    <Typography variant="h5" sx={{ mb: 1 }}>Step 4: Await WhatsApp Reply</Typography>
                  </Box>

                  <Box sx={{ p: 3, borderRadius: 4, bgcolor: "#f8fbf9", border: "1px solid", borderColor: "divider" }}>
                    <Stack spacing={1.25}>
                      <Typography variant="overline" color="text.secondary">Dispatch Status</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip label={`Channel: WhatsApp`} color="success" variant="outlined" />
                        <Chip label={`Survey Status: ${workflow?.activeWorkflow?.status || workflow?.patient?.surveyStatus || "sent"}`} color="primary" variant="outlined" />
                        <Chip label={`Reply Number: ${workflow?.patient?.whatsappNumber || phoneInput || selected?.phone}`} variant="outlined" />
                        {workflow?.activeWorkflow?.surveyMessageSid && <Chip label={`Message SID: ${workflow.activeWorkflow.surveyMessageSid}`} variant="outlined" />}
                        {(workflow?.twilioSurveyStatus?.status || workflow?.activeWorkflow?.twilioSurveyStatus?.status) && (
                          <Chip label={`Twilio: ${workflow?.twilioSurveyStatus?.status || workflow?.activeWorkflow?.twilioSurveyStatus?.status}`} color="secondary" variant="outlined" />
                        )}
                      </Stack>
                      {(workflow?.twilioSurveyStatus?.explanation || workflow?.activeWorkflow?.twilioSurveyStatus?.explanation || workflow?.twilioSurveyStatus?.errorMessage || workflow?.activeWorkflow?.twilioSurveyStatus?.errorMessage) && (
                        <Typography variant="body2" sx={{ color: "error.main" }}>
                          Twilio error: {workflow?.twilioSurveyStatus?.explanation || workflow?.activeWorkflow?.twilioSurveyStatus?.explanation || workflow?.twilioSurveyStatus?.errorMessage || workflow?.activeWorkflow?.twilioSurveyStatus?.errorMessage}
                        </Typography>
                      )}
                    </Stack>
                  </Box>

                  {workflow?.patient?.surveyRequestMessage && (
                    <Box sx={{ p: 2.5, borderRadius: 4, bgcolor: "rgba(15, 138, 95, 0.08)", borderLeft: "4px solid #0f8a5f" }}>
                      <Typography variant="overline" sx={{ color: "primary.main" }}>Outgoing WhatsApp Prompt</Typography>
                      <Typography variant="body1" sx={{ mt: 1 }}>
                        {workflow.patient.surveyRequestMessage}
                      </Typography>
                    </Box>
                  )}

                  <Stack spacing={1.5}>
                    <Typography variant="overline" color="text.secondary">Conversation</Typography>
                    {(workflow?.patient?.whatsappMessages || []).length === 0 ? (
                      <Typography color="text.secondary">The conversation thread will appear here as soon as the outbound message is recorded.</Typography>
                    ) : (
                      <Stack spacing={1.5}>
                        {(workflow?.patient?.whatsappMessages || []).map((message: any, index: number) => (
                          <Box
                            key={`${message.twilioSid || message.createdAt || index}-${index}`}
                            sx={{
                              alignSelf: message.direction === "outbound" ? "flex-end" : "flex-start",
                              maxWidth: { xs: "100%", md: "75%" },
                              px: 2,
                              py: 1.5,
                              borderRadius: 4,
                              bgcolor: message.direction === "outbound" ? "#e7f6ef" : "#ffffff",
                              border: "1px solid",
                              borderColor: message.direction === "outbound" ? "#b9dfcf" : "divider",
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {message.direction === "outbound"
                                ? "Hospital to patient"
                                : message.senderName || workflow?.patient?.name || selected?.name || "Patient"}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.75 }}>{message.body}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          {step === 5 && (
            <Card>
              <CardContent sx={{ p: 6, textAlign: "center" }}>
                <Stack spacing={2.5} alignItems="center">
                  <CircularProgress color="primary" />
                  <Typography variant="h5">Gemini Analyzing</Typography>
                  <Typography color="text.secondary">Patient feedback has been received from WhatsApp. Gemini is extracting sentiment, entities, severity, and the response message.</Typography>
                </Stack>
              </CardContent>
            </Card>
          )}

          {step === 6 && result && (
            <Stack spacing={3}>
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Stack spacing={3} sx={{ maxWidth: 980 }}>
                    <Box>
                      <Typography variant="h5" sx={{ mb: 1 }}>Analysis Complete</Typography>
                      <Chip
                        label={`${result.analysis.sentiment} Sentiment`}
                        variant="outlined"
                        sx={{
                          mt: 1,
                          color: getSentimentColor(result.analysis.sentiment).color,
                          bgcolor: getSentimentColor(result.analysis.sentiment).bg,
                          borderColor: getSentimentColor(result.analysis.sentiment).border,
                        }}
                      />
                    </Box>

                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" },
                        gap: 2,
                      }}
                    >
                      {[
                        { label: "Severity", value: `${result.analysis.severity}/5`, severity: true },
                        { label: "Category", value: result.analysis.category },
                          { label: "Confidence", value: `${Math.abs(Math.round((result.analysis.sentimentScore || 0) * 100))}%` },
                        { label: "Ticket", value: result.step3_ticketCreated || "—" },
                      ].map((item) => (
                        <Box
                          key={item.label}
                          sx={{
                            p: 2.5,
                            borderRadius: 4,
                            bgcolor: "#f8fbf9",
                            border: "1px solid",
                            borderColor: "divider",
                            textAlign: "center",
                          }}
                        >
                          <Typography variant="overline" color="text.secondary">{item.label}</Typography>
                          {item.severity ? (
                            <Stack alignItems="center" spacing={1} sx={{ mt: 1 }}>
                              <Stack direction="row" spacing={0.75}>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Box
                                    key={n}
                                    sx={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: 1,
                                      bgcolor: n <= result.analysis.severity ? getSeverityColor(result.analysis.severity) : "#d8e2dc",
                                    }}
                                  />
                                ))}
                              </Stack>
                              <Typography variant="h6">{item.value}</Typography>
                            </Stack>
                          ) : (
                            <Typography variant="h6" sx={{ mt: 1 }}>{item.value}</Typography>
                          )}
                        </Box>
                      ))}
                    </Box>

                    {result.analysis.complaintEntities?.length > 0 && (
                      <Box>
                        <Typography variant="overline" color="text.secondary">Extracted Entities</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                          {result.analysis.complaintEntities.map((entity: string, index: number) => (
                            <Chip key={`${entity}-${index}`} label={entity} sx={{ bgcolor: "rgba(15, 138, 95, 0.10)", color: "primary.main" }} />
                          ))}
                        </Stack>
                      </Box>
                    )}

                    <Box sx={{ p: 2.5, borderRadius: 4, bgcolor: "#f8fbf9", border: "1px solid", borderColor: "divider" }}>
                      <Typography variant="overline" color="text.secondary">AI Summary</Typography>
                      <Typography variant="body1" sx={{ mt: 1 }}>{result.analysis.summary}</Typography>
                    </Box>

                    <Box sx={{ p: 2.5, borderRadius: 4, bgcolor: "#f8fbf9", border: "1px solid", borderColor: "divider" }}>
                      <Typography variant="overline" color="text.secondary">Conversation History</Typography>
                      {timelineMessages.length === 0 ? (
                        <Typography color="text.secondary" sx={{ mt: 1 }}>No conversation messages are available for this workflow.</Typography>
                      ) : (
                        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                          {timelineMessages.map((message: any, index: number) => (
                            <Box
                              key={`${message.twilioSid || message.createdAt || index}-final-${index}`}
                              sx={{
                                alignSelf: message.direction === "outbound" ? "flex-end" : "flex-start",
                                maxWidth: { xs: "100%", md: "75%" },
                                px: 2,
                                py: 1.5,
                                borderRadius: 4,
                                bgcolor: message.direction === "outbound" ? "#e7f6ef" : "#ffffff",
                                border: "1px solid",
                                borderColor: message.direction === "outbound" ? "#b9dfcf" : "divider",
                              }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                {message.direction === "outbound"
                                  ? "Hospital to patient"
                                  : message.senderName || workflow?.patient?.name || selected?.name || "Patient"}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.75 }}>{message.body}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Box>

                    {outcomeMessage && (
                      <Box sx={{ p: 2.5, borderRadius: 4, bgcolor: "rgba(15, 138, 95, 0.08)", borderLeft: "4px solid #0f8a5f" }}>
                        <Typography variant="overline" sx={{ color: "primary.main" }}>{outcomeLabel}</Typography>
                        <Typography variant="body1" sx={{ mt: 1, fontStyle: "italic" }}>
                          "{outcomeMessage}"
                        </Typography>
                      </Box>
                    )}

                    <Box>
                      <Typography variant="overline" color="text.secondary">Actions Taken</Typography>
                      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                        {completedActions.map((label) => (
                          <Box
                            key={label}
                            sx={{
                              px: 2,
                              py: 1.5,
                              borderRadius: 4,
                              border: "1px solid",
                              borderColor: "#b9dfcf",
                              bgcolor: "#e7f6ef",
                              color: "#0f8a5f",
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              fontWeight: 600,
                            }}
                          >
                            <Box
                              sx={{
                                width: 14,
                                height: 14,
                                borderRadius: 999,
                                bgcolor: "#0f8a5f",
                              }}
                            />
                            {label}
                          </Box>
                        ))}
                        {completedActions.length === 0 && (
                          <Typography color="text.secondary">No follow-up actions were required for this workflow.</Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              <Button variant="outlined" size="large" onClick={handleReset} sx={{ alignSelf: "flex-start" }}>
                Simulate Another Patient
              </Button>
            </Stack>
          )}
        </Stack>

        <Card sx={{ position: { xl: "sticky" }, top: { xl: 24 }, width: "100%", maxWidth: 340, justifySelf: { xs: "stretch", xl: "end" } }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2.5 }}>Live Agent Log</Typography>

            {log.length === 0 ? (
              <Typography color="text.secondary">Agent activity will appear here as the workflow progresses.</Typography>
            ) : (
              <Stack spacing={1.5}>
                {log.map((entry, index) => (
                  <Box
                    key={index}
                    sx={{
                      px: 2,
                      py: 1.5,
                      borderRadius: 4,
                      bgcolor: "#f8fbf9",
                      borderLeft: "4px solid #0f8a5f",
                      fontFamily: "monospace",
                      fontSize: 12,
                      lineHeight: 1.75,
                    }}
                  >
                    {entry}
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
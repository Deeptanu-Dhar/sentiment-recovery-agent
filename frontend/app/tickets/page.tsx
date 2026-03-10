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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import TopBar from "@/components/TopBar";
import { getTickets, updateTicket } from "@/lib/api";

const statusStyles: Record<string, { color: string; bg: string; border: string }> = {
  Open: { color: "#d64545", bg: "#ffe8e8", border: "#f0b8b8" },
  "In Progress": { color: "#b87800", bg: "#fff5db", border: "#f0db9c" },
  Resolved: { color: "#0f8a5f", bg: "#e7f6ef", border: "#b9dfcf" },
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  const load = () => getTickets().then(setTickets).catch(console.error).finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const filtered = filter === "All" ? tickets : tickets.filter((ticket) => ticket.status === filter);

  const handleStatus = async (ticketId: string, status: string) => {
    await updateTicket(ticketId, status);
    load();
  };

  return (
    <Box sx={{ maxWidth: 1160, mx: "auto" }}>
      <TopBar title="Complaint Tickets" subtitle="Manage open complaint cases, SLA breaches, and resolution progress with a cleaner operational view." />

      <Box sx={{ maxWidth: 1160, mx: "auto" }}>
        <ToggleButtonGroup
          exclusive
          value={filter}
          onChange={(_, nextValue) => {
            if (nextValue) setFilter(nextValue);
          }}
          sx={{ mb: 4, flexWrap: "wrap", gap: 1.25 }}
        >
          {["All", "Open", "In Progress", "Resolved"].map((status) => (
            <ToggleButton key={status} value={status} sx={{ borderRadius: "999px !important", px: 2.5, py: 1.15 }}>
              {status} ({status === "All" ? tickets.length : tickets.filter((ticket) => ticket.status === status).length})
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
            <CircularProgress color="primary" />
          </Stack>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent sx={{ p: 6, textAlign: "center" }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>No tickets found</Typography>
              <Typography color="text.secondary">Try a different filter or create new complaint activity through the simulator.</Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={3}>
            {filtered.map((ticket) => {
              const breached = ticket.slaDeadline && new Date(ticket.slaDeadline) < new Date() && ticket.status !== "Resolved";
              const status = statusStyles[ticket.status] || { color: "#587066", bg: "#f6f8f7", border: "#d8e2dc" };

              return (
                <Card key={ticket._id}>
                  <CardContent sx={{ p: 3.5 }}>
                    <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={3}>
                      <Stack spacing={2} sx={{ flex: 1, maxWidth: 820 }}>
                        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap alignItems="center">
                          <Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{ticket.ticketId}</Typography>
                          <Chip label={ticket.status} variant="outlined" sx={{ color: status.color, bgcolor: status.bg, borderColor: status.border }} />
                          {breached && <Chip label="SLA Breached" color="error" variant="outlined" />}
                        </Stack>

                        <Box>
                          <Typography variant="h6" sx={{ mb: 0.75 }}>
                            {ticket.patientName} • {ticket.department}
                          </Typography>
                          <Typography variant="body1" color="text.secondary">
                            {ticket.description}
                          </Typography>
                        </Box>

                        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                          <Chip label={ticket.category} variant="outlined" />
                          <Chip label={`Severity ${ticket.severity}/5`} variant="outlined" />
                        </Stack>
                      </Stack>

                      <Stack direction={{ xs: "row", lg: "column" }} spacing={1.5} justifyContent="flex-start" alignItems={{ xs: "stretch", lg: "flex-end" }}>
                        {ticket.status === "Open" && (
                          <Button variant="contained" color="warning" onClick={() => handleStatus(ticket.ticketId, "In Progress")} sx={{ minWidth: 138 }}>
                            Start
                          </Button>
                        )}
                        {ticket.status === "In Progress" && (
                          <Button variant="contained" color="primary" onClick={() => handleStatus(ticket.ticketId, "Resolved")} sx={{ minWidth: 138 }}>
                            Resolve
                          </Button>
                        )}
                      </Stack>
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
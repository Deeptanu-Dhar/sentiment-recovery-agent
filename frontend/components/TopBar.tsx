"use client";
import { Divider, Stack, Typography } from "@mui/material";

interface Props {
  title: string;
  subtitle: string;
}

export default function TopBar({ title, subtitle }: Props) {
  return (
    <>
      <Stack
        className="section-enter"
        spacing={1.5}
        sx={{
          mb: 3.5,
          maxWidth: 920,
          mx: "auto",
          alignItems: { xs: "flex-start", md: "center" },
          textAlign: { xs: "left", md: "center" },
        }}
      >
        <Typography variant="h3" sx={{ fontSize: { xs: 32, md: 40 }, lineHeight: 1.08 }}>
          {title}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ maxWidth: 760 }}>
          {subtitle}
        </Typography>
      </Stack>
      <Divider sx={{ mb: 4, maxWidth: 1180, mx: "auto" }} />
    </>
  );
}
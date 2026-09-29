import { Badge } from "./ui/Badge.js";

interface EventStatusBadgeProps {
  status: string;
}

export function EventStatusBadge({ status }: EventStatusBadgeProps) {
  const variant = status === "success" ? "success" : "danger";
  return <Badge variant={variant}>{status}</Badge>;
}

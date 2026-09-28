interface EventStatusBadgeProps {
  status: string;
}

export function EventStatusBadge({ status }: EventStatusBadgeProps) {
  const isSuccess = status === "success";
  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: "3px",
      fontSize: "0.8em",
      fontWeight: "bold",
      background: isSuccess ? "#1a3d1a" : "#3d1a1a",
      color: isSuccess ? "#4caf50" : "#f44336",
      border: `1px solid ${isSuccess ? "#4caf50" : "#f44336"}`,
    }}>
      {status}
    </span>
  );
}

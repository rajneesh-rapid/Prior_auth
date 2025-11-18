import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

interface StatusBadgeProps {
  status: "Accepted" | "Denied" | "Pending" | "Under Review" | "Approved" | "Partially Approved";
  date?: string;
  className?: string;
}

export function StatusBadge({ status, date, className }: StatusBadgeProps) {
  const config = {
    Accepted: {
      variant: "success" as const,
      icon: CheckCircle2,
    },
    Denied: {
      variant: "destructive" as const,
      icon: XCircle,
    },
    Pending: {
      variant: "warning" as const,
      icon: Clock,
    },
    "Under Review": {
      variant: "secondary" as const,
      icon: AlertCircle,
    },
    Approved: {
      variant: "success" as const,
      icon: CheckCircle2,
    },
    "Partially Approved": {
      variant: "secondary" as const,
      icon: AlertCircle,
    },
  };

  const { variant, icon: Icon } = config[status] || config.Accepted;

  return (
    <Badge variant={variant} className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {date && <span className="mr-1">{date}</span>}
      {status}
    </Badge>
  );
}

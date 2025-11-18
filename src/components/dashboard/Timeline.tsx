import { TimelineEntry } from "@/types/claim";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineProps {
  entries: TimelineEntry[];
  variant?: "status" | "reason";
}

export function Timeline({ entries, variant = "status" }: TimelineProps) {
  if (!entries || entries.length === 0) return null;

  return (
    <div className="space-y-2 py-2">
      {entries.map((entry, index) => (
        <div key={index} className="flex items-start gap-2 relative">
          {index !== entries.length - 1 && (
            <div className="absolute left-[7px] top-6 bottom-0 w-px bg-border" />
          )}
          <Circle
            className={cn(
              "h-4 w-4 mt-0.5 flex-shrink-0 relative z-10",
              variant === "status" && entry.label === "Accepted" && "fill-success text-success",
              variant === "status" && entry.label === "Denied" && "fill-destructive text-destructive",
              variant === "status" && entry.label === "Pending" && "fill-warning text-warning",
              variant === "status" && entry.label === "Under Review" && "fill-primary text-primary",
              variant === "reason" && "fill-muted-foreground text-muted-foreground"
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">
                {new Date(entry.date).toLocaleDateString()}
              </span>
              <span className="text-sm font-medium text-foreground">{entry.label}</span>
              {entry.user && (
                <span className="text-xs text-muted-foreground">by {entry.user}</span>
              )}
            </div>
            {entry.comment && (
              <p className="text-xs text-muted-foreground mt-1">{entry.comment}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

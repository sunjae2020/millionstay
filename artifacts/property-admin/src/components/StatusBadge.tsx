import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  Active: "bg-green-100 text-green-800 border border-green-200",
  Pending: "bg-amber-100 text-amber-800 border border-amber-200",
  Suspended: "bg-rose-100 text-rose-800 border border-rose-200",
  Rejected: "bg-gray-100 text-gray-600 border border-gray-200",
  Inactive: "bg-gray-100 text-gray-600 border border-gray-200",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClass = statusColors[status] ?? "bg-gray-100 text-gray-600 border border-gray-200";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colorClass,
        className
      )}
    >
      {status}
    </span>
  );
}

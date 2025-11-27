"use client";

export type AlertType = "warning" | "danger" | "info";

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
}

interface AlertsCardProps {
  alerts: Alert[];
}

export function AlertsCard({ alerts }: AlertsCardProps) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="card p-6">
      <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">
        Alerts & Notifications
      </h2>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  );
}

function AlertItem({ alert }: { alert: Alert }) {
  const bgColors: Record<AlertType, string> = {
    danger: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    warning: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  };

  const iconColors: Record<AlertType, string> = {
    danger: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    info: "text-blue-600 dark:text-blue-400",
  };

  const icons: Record<AlertType, string> = {
    danger: "⛔",
    warning: "⚠️",
    info: "ℹ️",
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${bgColors[alert.type]}`}
    >
      <span className={`text-lg ${iconColors[alert.type]}`}>
        {icons[alert.type]}
      </span>
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {alert.title}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {alert.message}
        </p>
      </div>
    </div>
  );
}

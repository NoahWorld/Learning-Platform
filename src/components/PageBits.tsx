import { AlertTriangle, ArrowRight, Inbox, LoaderCircle, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow"><Sparkles size={15} aria-hidden="true" /> {eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function LoadingState({ label = "正在整理内容…" }: { label?: string }) {
  return (
    <div className="state-panel loading-state" role="status">
      <LoaderCircle className="spin" size={28} aria-hidden="true" />
      <strong>{label}</strong>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="state-panel error-state" role="alert">
      <AlertTriangle size={28} aria-hidden="true" />
      <div>
        <strong>这部分暂时没加载出来</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}

export function EmptyState({ title, description, actionLabel, actionTo }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true"><Inbox size={34} /></span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {actionLabel && actionTo ? (
        <Link className="text-link" to={actionTo}>
          {actionLabel} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export function ScoreSticker({ score, passingScore = 60 }: { score: number; passingScore?: number }) {
  const passed = score >= passingScore;
  return (
    <span className={`score-sticker ${passed ? "passed" : "keep-going"}`}>
      <strong>{score}</strong>
      <small>分</small>
    </span>
  );
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder > 0 ? `${minutes} 分 ${remainder} 秒` : `${minutes} 分钟`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

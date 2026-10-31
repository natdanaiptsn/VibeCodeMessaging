import { CheckCircle2, CircleDashed, Clock, Loader2, MinusCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MESSAGE_STATUS_LABELS, REPLY_STATUS_LABELS } from "@/lib/labels";

export function ReplyStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "SUCCESS":
      return <Badge variant="success"><CheckCircle2 /> {REPLY_STATUS_LABELS.SUCCESS}</Badge>;
    case "FAILED":
      return <Badge variant="destructive"><XCircle /> {REPLY_STATUS_LABELS.FAILED}</Badge>;
    case "PROCESSING":
      return <Badge variant="info"><Loader2 className="animate-spin" /> {REPLY_STATUS_LABELS.PROCESSING}</Badge>;
    default:
      return <Badge variant="warning"><Clock /> {REPLY_STATUS_LABELS.PENDING}</Badge>;
  }
}

export function MessageStatusBadge({ status }: { status: string }) {
  const label = MESSAGE_STATUS_LABELS[status] ?? status;
  switch (status) {
    case "REPLIED":
    case "SENT":
      return <Badge variant="success"><CheckCircle2 /> {label}</Badge>;
    case "FAILED":
      return <Badge variant="destructive"><XCircle /> {label}</Badge>;
    case "NO_REPLY":
      return <Badge variant="muted"><MinusCircle /> {label}</Badge>;
    case "PROCESSING":
      return <Badge variant="info"><Loader2 className="animate-spin" /> {label}</Badge>;
    default:
      return <Badge variant="warning"><CircleDashed /> {label}</Badge>;
  }
}

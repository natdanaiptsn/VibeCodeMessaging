import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export function CustomerAvatar({
  name,
  pictureUrl,
  className,
}: {
  name?: string | null;
  pictureUrl?: string | null;
  className?: string;
}) {
  const initial = (name?.trim() || "?").slice(0, 1).toUpperCase();
  return (
    <Avatar className={cn(className)}>
      {pictureUrl && <AvatarImage src={pictureUrl} alt={name ?? ""} referrerPolicy="no-referrer" />}
      <AvatarFallback>{initial}</AvatarFallback>
    </Avatar>
  );
}

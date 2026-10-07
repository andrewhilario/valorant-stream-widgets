import { MessageSquare } from "lucide-react";
import { feedback } from "@/config/site";

/**
 * "Feedback": a quiet link to the owner's feedback form (see config/site.ts). It only shows while the form's address is set,
 * opens in a new tab, and sends nothing along: no referrer, and no cookie or count from this site.
 */
export function FeedbackLink() {
  if (!feedback.url) return null;
  return (
    <a className="textlink" href={feedback.url} target="_blank" rel="noopener noreferrer">
      <MessageSquare aria-hidden="true" />
      <span>Feedback</span>
    </a>
  );
}

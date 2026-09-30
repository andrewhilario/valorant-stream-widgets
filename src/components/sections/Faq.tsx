import type { FaqItem } from "@/content/faq";
import { SupportLink } from "./SupportLink";

/** An accordion of questions. One <details> per question, so it works with no JavaScript. */
export function Faq({ id = "questions", title = "Questions", items }: { id?: string; title?: string; items: FaqItem[] }) {
  return (
    <section className="section" id={id} aria-labelledby={`${id}-title`}>
      <div className="section__inner">
        <h2 id={`${id}-title`}>{title}</h2>
        <div className="faq">
          {items.map((item) => (
            <details key={item.q} className="faq__item">
              <summary>{item.q}</summary>
              <div className="faq__answer">
                {item.paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
                {item.support && (
                  <p>
                    <SupportLink variant="link" />
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

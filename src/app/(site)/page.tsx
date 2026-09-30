import { JsonLd } from "@/components/seo/JsonLd";
import { Playground } from "@/components/playground/Playground";
import { Faq } from "@/components/sections/Faq";
import { Steps } from "@/components/sections/Steps";
import { Footer } from "@/components/site/Footer";
import { pages } from "@/config/pages";
import { faqForLd, overlayFaq } from "@/content/faq";
import { faqLd, pageMetadata, webApplicationLd } from "@/lib/seo";
import { defaultWidgetId } from "@/widgets/registry";

const page = pages.overlay;

export const metadata = pageMetadata(page);

export default function Home() {
  return (
    <>
      <JsonLd
        data={[
          webApplicationLd(page, {
            featureList: [
              "Live Valorant rank, RR and peak rank",
              "Session stats worked out from match history",
              "Four layouts, including a tall one for vertical streams",
              "Live preview on a landscape or vertical canvas",
              "One link for OBS, Streamlabs Desktop or TikTok LIVE Studio",
            ],
          }),
          faqLd(faqForLd(overlayFaq)),
        ]}
      />
      <Playground
        widgetId={defaultWidgetId}
        below={
          <>
            <Steps />
            <Faq items={overlayFaq} />
          </>
        }
        footer={<Footer />}
      />
    </>
  );
}

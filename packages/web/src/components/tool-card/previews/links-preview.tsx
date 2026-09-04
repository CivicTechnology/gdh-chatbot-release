import { memo, useState } from "react";
import { PreviewItem, PreviewList } from "../tool-card-preview";

type RelevantLink = {
  title: string;
  url: string;
  category: string;
  description: string;
};

type LinksPreviewProps = {
  links: RelevantLink[];
  maxItems?: number;
};

function PureLinksPreview({ links, maxItems = 3 }: LinksPreviewProps) {
  const [showAll, setShowAll] = useState(false);

  const displayedLinks = showAll ? links : links.slice(0, maxItems);
  const moreCount = showAll ? 0 : Math.max(0, links.length - maxItems);

  return (
    <PreviewList moreCount={moreCount} onShowMore={() => setShowAll(true)}>
      {displayedLinks.map((link) => (
        <PreviewItem
          key={link.url}
          subtitle={getHostname(link.url)}
          title={link.title}
          url={link.url}
        />
      ))}
    </PreviewList>
  );
}

function getHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return undefined;
  }
}

export const LinksPreview = memo(PureLinksPreview);

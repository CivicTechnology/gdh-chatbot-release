import { memo, useState } from "react";
import { PreviewItem, PreviewList } from "../tool-card-preview";

type Document = {
  id: string;
  source: {
    title: string | null;
    url: string | null;
    category: string | null;
  };
};

type DocumentsPreviewProps = {
  documents: Document[];
  maxItems?: number;
};

function PureDocumentsPreview({
  documents,
  maxItems = 3,
}: DocumentsPreviewProps) {
  const [showAll, setShowAll] = useState(false);

  const displayedDocs = showAll ? documents : documents.slice(0, maxItems);
  const moreCount = showAll ? 0 : Math.max(0, documents.length - maxItems);

  return (
    <PreviewList moreCount={moreCount} onShowMore={() => setShowAll(true)}>
      {displayedDocs.map((doc) => (
        <PreviewItem
          key={doc.id}
          subtitle={doc.source.category || getCategoryFromUrl(doc.source.url)}
          title={doc.source.title || "Onbekend document"}
          url={doc.source.url}
        />
      ))}
    </PreviewList>
  );
}

function getCategoryFromUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace("www.", "");
  } catch {
    return undefined;
  }
}

export const DocumentsPreview = memo(PureDocumentsPreview);

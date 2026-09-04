import { memo, useState } from "react";
import { PreviewItem, PreviewList } from "../tool-card-preview";

type DatasetInfo = {
  recordCount: number;
  fields: string[];
};

type CkanInfoPreviewProps = {
  datasets: Record<string, DatasetInfo>;
  maxItems?: number;
};

function PureCkanInfoPreview({ datasets, maxItems = 3 }: CkanInfoPreviewProps) {
  const [showAll, setShowAll] = useState(false);

  const entries = Object.entries(datasets);
  const displayedEntries = showAll ? entries : entries.slice(0, maxItems);
  const moreCount = showAll ? 0 : Math.max(0, entries.length - maxItems);

  return (
    <PreviewList moreCount={moreCount} onShowMore={() => setShowAll(true)}>
      {displayedEntries.map(([name, info]) => (
        <PreviewItem
          key={name}
          subtitle={formatRecordCount(info.recordCount)}
          title={name}
        />
      ))}
    </PreviewList>
  );
}

function formatRecordCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M records`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K records`;
  }
  return `${count} records`;
}

export const CkanInfoPreview = memo(PureCkanInfoPreview);

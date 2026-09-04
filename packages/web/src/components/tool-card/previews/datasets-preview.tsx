import { memo, useState } from "react";
import { PreviewItem, PreviewList } from "../tool-card-preview";

type Dataset = {
  name: string;
  displayName: string;
  description: string | null;
  recordCount: number;
};

type DatasetsPreviewProps = {
  datasets: Dataset[];
  maxItems?: number;
};

function PureDatasetsPreview({ datasets, maxItems = 3 }: DatasetsPreviewProps) {
  const [showAll, setShowAll] = useState(false);

  const displayedDatasets = showAll ? datasets : datasets.slice(0, maxItems);
  const moreCount = showAll ? 0 : Math.max(0, datasets.length - maxItems);

  return (
    <PreviewList moreCount={moreCount} onShowMore={() => setShowAll(true)}>
      {displayedDatasets.map((dataset) => (
        <PreviewItem
          key={dataset.name}
          subtitle={formatRecordCount(dataset.recordCount)}
          title={dataset.displayName}
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

export const DatasetsPreview = memo(PureDatasetsPreview);

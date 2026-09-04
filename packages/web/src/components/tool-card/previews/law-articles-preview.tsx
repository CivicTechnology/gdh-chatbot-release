import { memo, useState } from "react";
import { PreviewItem, PreviewList } from "../tool-card-preview";

type LawArticle = {
  id: string;
  location: string;
  articleNumber: string | null;
  articleTitle: string | null;
  preferredUrl: string | null;
};

type LawArticlesPreviewProps = {
  articles: LawArticle[];
  maxItems?: number;
};

function PureLawArticlesPreview({
  articles,
  maxItems = 3,
}: LawArticlesPreviewProps) {
  const [showAll, setShowAll] = useState(false);

  const displayedArticles = showAll ? articles : articles.slice(0, maxItems);
  const moreCount = showAll ? 0 : Math.max(0, articles.length - maxItems);

  return (
    <PreviewList moreCount={moreCount} onShowMore={() => setShowAll(true)}>
      {displayedArticles.map((article) => (
        <PreviewItem
          key={article.id}
          subtitle={article.articleTitle || undefined}
          title={formatArticleLocation(article)}
          url={article.preferredUrl}
        />
      ))}
    </PreviewList>
  );
}

function formatArticleLocation(article: LawArticle): string {
  if (article.articleNumber) {
    return `Art. ${article.articleNumber}`;
  }
  // Fall back to location, but shorten it
  const location = article.location;
  // Extract article number from location if present
  const match = location.match(/artikel\s+(\d+(?:\.\d+)?)/i);
  if (match) {
    return `Art. ${match[1]}`;
  }
  return location.length > 40 ? `${location.slice(0, 40)}...` : location;
}

export const LawArticlesPreview = memo(PureLawArticlesPreview);

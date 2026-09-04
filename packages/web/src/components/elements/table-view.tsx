import ExcelJS from "exceljs";
import {
  CheckIcon,
  ClipboardIcon,
  DownloadIcon,
  Maximize2,
  Minimize2,
  Search,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import DataGrid, { type Column, type SortColumn } from "react-data-grid";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

import "react-data-grid/lib/styles.css";

export type TableColumn = {
  key: string;
  name: string;
};

export type TableViewProps = {
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
  title?: string;
  sheetName?: string;
  totalRows?: number;
  truncated?: boolean;
  className?: string;
};

function TableViewInner({
  columns,
  rows,
  title,
  sheetName,
  totalRows,
  truncated,
  className,
}: TableViewProps) {
  const { resolvedTheme } = useTheme();
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Convert rows to CSV string
  const toCSV = useCallback(
    (data: Array<Record<string, unknown>>) => {
      const headers = columns.map((c) => c.name).join("\t");
      const csvRows = data.map((row) =>
        columns
          .map((col) => {
            const value = row[col.key];
            if (value === null || value === undefined) return "";
            if (typeof value === "object") return JSON.stringify(value);
            return String(value);
          })
          .join("\t")
      );
      return [headers, ...csvRows].join("\n");
    },
    [columns]
  );

  // Copy to clipboard as CSV
  const handleCopyCSV = useCallback(async () => {
    const csv = toCSV(rows);
    await navigator.clipboard.writeText(csv);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  }, [rows, toCSV]);

  // Download as Excel with ExcelJS (proper table support)
  const handleDownloadExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const effectiveSheetName = sheetName || title?.slice(0, 31) || "Data";
    const worksheet = workbook.addWorksheet(effectiveSheetName, {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    // Prepare data rows with proper typing
    const dataRows = rows.map((row) =>
      columns.map((col) => {
        const value = row[col.key];
        if (value === null || value === undefined) return "";
        if (typeof value === "object") return JSON.stringify(value);
        if (typeof value === "number") return value;
        if (typeof value === "boolean") return value;
        // Try to parse numeric strings
        const numValue = Number(value);
        if (!Number.isNaN(numValue) && String(value).trim() !== "") {
          return numValue;
        }
        return String(value);
      })
    );

    // Add as Excel Table with filters and styling
    worksheet.addTable({
      name: "DataTable",
      ref: "A1",
      headerRow: true,
      totalsRow: false,
      style: {
        theme: "TableStyleMedium2",
        showRowStripes: true,
      },
      columns: columns.map((col) => ({
        name: col.name,
        filterButton: true,
      })),
      rows: dataRows,
    });

    // Auto-fit column widths
    worksheet.columns.forEach((column, colIndex) => {
      const col = columns[colIndex];
      let maxWidth = col.name.length;
      for (const row of rows) {
        const value = row[col.key];
        const strValue =
          value === null || value === undefined
            ? ""
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value);
        maxWidth = Math.max(maxWidth, strValue.length);
      }
      column.width = Math.min(maxWidth + 2, 50);
    });

    // Generate filename
    const filename = sheetName
      ? `${sheetName.toLowerCase().replace(/\s+/g, "-")}.xlsx`
      : title
        ? `${title.toLowerCase().replace(/\s+/g, "-")}.xlsx`
        : "tabel-export.xlsx";

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [columns, rows, title, sheetName]);

  // Close on Escape key
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Convert columns to react-data-grid format
  const gridColumns: readonly Column<Record<string, unknown>>[] =
    useMemo(() => {
      return columns.map((col, index) => ({
        key: col.key,
        name: col.name,
        resizable: true,
        sortable: true,
        // Use flex to fill available space with min width
        minWidth: 120,
        flex: 1,
        cellClass: cn(
          "!border-b !border-border/50 !px-4 !py-3",
          index === 0 && "!pl-5"
        ),
        headerCellClass: cn(
          "!border-b !border-border !px-4 !py-3 !font-medium",
          index === 0 && "!pl-5"
        ),
        renderCell: ({ row }) => {
          const value = row[col.key];
          if (value === null || value === undefined) {
            return <span className="text-muted-foreground/50">-</span>;
          }
          if (typeof value === "object") return JSON.stringify(value);
          return String(value);
        },
      }));
    }, [columns]);

  // Filter rows based on search term
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;

    const lowerSearch = searchTerm.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((value) => {
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(lowerSearch);
      })
    );
  }, [rows, searchTerm]);

  // Sort rows based on sort columns
  const sortedRows = useMemo(() => {
    if (sortColumns.length === 0) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      for (const { columnKey, direction } of sortColumns) {
        const aVal = a[columnKey];
        const bVal = b[columnKey];

        // Handle nullish values
        if (aVal == null && bVal == null) continue;
        if (aVal == null) return direction === "ASC" ? -1 : 1;
        if (bVal == null) return direction === "ASC" ? 1 : -1;

        // Try numeric comparison first
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
          const diff = aNum - bNum;
          if (diff !== 0) return direction === "ASC" ? diff : -diff;
          continue;
        }

        // Fall back to string comparison
        const aStr = String(aVal);
        const bStr = String(bVal);
        const cmp = aStr.localeCompare(bStr, "nl");
        if (cmp !== 0) return direction === "ASC" ? cmp : -cmp;
      }
      return 0;
    });
  }, [filteredRows, sortColumns]);

  const displayedCount = sortedRows.length;
  const actualTotal = totalRows ?? rows.length;

  const tableContent = (
    <div
      className={cn(
        "flex flex-col gap-4",
        isExpanded && "h-full",
        !isExpanded && className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {title && (
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
          )}
          <span className="text-sm text-muted-foreground">
            {searchTerm
              ? `${displayedCount} van ${actualTotal} rijen`
              : `${actualTotal} rijen`}
            {truncated && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                (afgekapt)
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Zoeken..."
              type="text"
              value={searchTerm}
            />
          </div>

          {/* Copy CSV button */}
          <button
            type="button"
            onClick={handleCopyCSV}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Kopieer als CSV"
          >
            {copiedFeedback ? (
              <CheckIcon className="h-4 w-4 text-green-600" />
            ) : (
              <ClipboardIcon className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {copiedFeedback ? "Gekopieerd" : "Kopieer"}
            </span>
          </button>

          {/* Download Excel button */}
          <button
            type="button"
            onClick={handleDownloadExcel}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Download als Excel"
          >
            <DownloadIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          {/* Expand button */}
          <button
            type="button"
            onClick={toggleExpanded}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={isExpanded ? "Verkleinen" : "Vergroten"}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-border",
          isExpanded && "flex-1"
        )}
        style={
          isExpanded
            ? undefined
            : { height: Math.min(450, 48 + sortedRows.length * 44) }
        }
      >
        <DataGrid
          className={cn(
            "h-full !border-0 text-sm",
            resolvedTheme === "dark" ? "rdg-dark" : "rdg-light"
          )}
          columns={gridColumns}
          defaultColumnOptions={{
            resizable: true,
            sortable: true,
          }}
          enableVirtualization
          onSortColumnsChange={setSortColumns}
          rowHeight={44}
          rows={sortedRows}
          sortColumns={sortColumns}
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );

  // When expanded, render as overlay covering the chat area
  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background p-6">
        {tableContent}
      </div>
    );
  }

  return tableContent;
}

export const TableView = memo(TableViewInner);

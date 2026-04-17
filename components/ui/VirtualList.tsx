import React from 'react';
import { FixedSizeList } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export const VirtualList = <T,>({
  items,
  itemHeight,
  renderItem,
  className = '',
}: VirtualListProps<T>) => {
  const Row = ({ index, style }: any) => (
    <div style={style}>
      {renderItem(items[index], index)}
    </div>
  );

  return (
    // @ts-ignore - react-virtualized-auto-sizer type compatibility issue
    <AutoSizer>
      {({ height, width }) => (
        <FixedSizeList
          height={height}
          width={width}
          itemCount={items.length}
          itemSize={itemHeight}
          className={className}
        >
          {Row}
        </FixedSizeList>
      )}
    </AutoSizer>
  );
};

interface VirtualGridProps<T> {
  items: T[];
  columnCount: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  height?: number;
}

export const VirtualGrid = <T,>({
  items,
  columnCount,
  itemHeight,
  renderItem,
  className = '',
  height = 600,
}: VirtualGridProps<T>) => {
  const rowCount = Math.ceil(items.length / columnCount);
  
  const getItemsForRow = (rowIndex: number): T[] => {
    const startIndex = rowIndex * columnCount;
    return items.slice(startIndex, startIndex + columnCount);
  };

  const GridRow = ({ index: rowIndex, style }: any) => {
    const rowItems = getItemsForRow(rowIndex);
    
    return (
      <div style={{ ...style, display: 'flex', gap: '1rem' }} className="px-2">
        {rowItems.map((item, colIndex) => {
          const globalIndex = rowIndex * columnCount + colIndex;
          return (
            <div key={globalIndex} className="flex-1">
              {renderItem(item, globalIndex)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <FixedSizeList
      height={height}
      width="100%"
      itemCount={rowCount}
      itemSize={itemHeight}
      className={className}
    >
      {GridRow}
    </FixedSizeList>
  );
};
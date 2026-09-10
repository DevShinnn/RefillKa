'use client';

import { peso } from '@/lib/format';
import type { Product } from '@/lib/types';

export function ProductCatalog({
  products,
  selectedId,
  withContainer,
  isReorder,
  onPickPrice,
  onTagReorder,
  showReorderTag = true,
  qtyFor,
}: {
  products: Product[];
  selectedId: string;
  withContainer: boolean;
  isReorder: boolean;
  onPickPrice: (productId: string, withContainer: boolean) => void;
  onTagReorder?: (productId: string) => void;
  showReorderTag?: boolean;
  qtyFor?: (productId: string, withContainer: boolean) => number;
}) {
  const food = products.filter((p) => p.category === 'food');
  const nonfood = products.filter((p) => p.category === 'nonfood');

  return (
    <div className="plist">
      <h2 className="plist__title">Products</h2>
      <CatalogGroup
        heading="FOOD"
        rows={food}
        selectedId={selectedId}
        withContainer={withContainer}
        isReorder={isReorder}
        onPickPrice={onPickPrice}
        onTagReorder={onTagReorder}
        showReorderTag={showReorderTag}
        qtyFor={qtyFor}
      />
      <CatalogGroup
        heading="NON-FOOD"
        rows={nonfood}
        selectedId={selectedId}
        withContainer={withContainer}
        isReorder={isReorder}
        onPickPrice={onPickPrice}
        onTagReorder={onTagReorder}
        showReorderTag={showReorderTag}
        qtyFor={qtyFor}
      />
    </div>
  );
}

function CatalogGroup({
  heading,
  rows,
  selectedId,
  withContainer,
  isReorder,
  onPickPrice,
  onTagReorder,
  showReorderTag,
  qtyFor,
}: {
  heading: string;
  rows: Product[];
  selectedId: string;
  withContainer: boolean;
  isReorder: boolean;
  onPickPrice: (productId: string, withContainer: boolean) => void;
  onTagReorder?: (productId: string) => void;
  showReorderTag: boolean;
  qtyFor?: (productId: string, withContainer: boolean) => number;
}) {
  return (
    <div className="plist__block">
      <div className="plist__group">{heading}</div>
      <div className="plist-cards">
        {rows.map((p) => {
          const refillQty = qtyFor?.(p.id, false) ?? 0;
          const containerQty = qtyFor?.(p.id, true) ?? 0;
          const refillOn = qtyFor ? refillQty > 0 : p.id === selectedId && !withContainer;
          const containerOn = qtyFor ? containerQty > 0 : p.id === selectedId && withContainer;
          const selected = qtyFor ? false : p.id === selectedId;
          return (
            <div key={p.id} className={`pcard${selected ? ' is-selected' : ''}`}>
              <div className="pcard__info">
                <div className="pcard__name">{p.name}</div>
                <div className="pcard__qty">{p.pack_qty}</div>
              </div>
              <div className="pcard__prices">
                <button
                  type="button"
                  className={`plist__price${refillOn ? ' is-on' : ''}`}
                  onClick={() => onPickPrice(p.id, false)}
                >
                  <span className="plist__kind">Refill</span>
                  <span className="plist__amt">{peso(p.price_refill)}</span>
                  {refillQty > 0 && <span className="plist__n">×{refillQty}</span>}
                </button>
                <button
                  type="button"
                  className={`plist__price${containerOn ? ' is-on' : ''}`}
                  onClick={() => onPickPrice(p.id, true)}
                >
                  <span className="plist__kind">Container</span>
                  <span className="plist__amt">{peso(p.price_with_container)}</span>
                  {containerQty > 0 && <span className="plist__n">×{containerQty}</span>}
                </button>
              </div>
              {showReorderTag && onTagReorder && (
                <button
                  type="button"
                  className={`plist__tag${selected && isReorder ? ' is-on' : ''}`}
                  onClick={() => onTagReorder(p.id)}
                  aria-pressed={selected && isReorder}
                >
                  {selected && isReorder ? 'Tagged reorder' : 'Tag if reorder'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

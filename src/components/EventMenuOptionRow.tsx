import { useEffect, useMemo, useState } from "react";

export type CatalogMenuRow = {
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
};

export type EventFormDish = {
  rowId: string;
  /** When set, save links to this existing menu_items row. Null for a brand-new custom dish. */
  menuItemId?: string | null;
  name: string;
  isNewItem: boolean;
};

type Props = {
  value: EventFormDish;
  catalog: CatalogMenuRow[];
  onChange: (next: EventFormDish) => void;
  onRemove: () => void;
  index: number;
};

export function EventMenuOptionRow({ value, catalog, onChange, onRemove, index }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const el = e.target as Node;
      if (!(el as Element).closest?.(".event-menu-search-wrap")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.slice(0, 25);
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 40);
  }, [catalog, query]);

  const pickCatalog = (row: CatalogMenuRow) => {
    onChange({
      ...value,
      menuItemId: row.id,
      name: row.name,
    });
    setQuery("");
    setOpen(false);
  };

  const clearToCustom = () => {
    onChange({ ...value, menuItemId: null, name: "" });
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="event-menu-option-row">
      <div className="event-menu-option-search">
        <label className="event-menu-option-label">
          <span>Dish #{index + 1}: search menu</span>
          <div className="event-menu-search-wrap">
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Type e.g. chicken, noodle…"
              autoComplete="off"
            />
            {open && (query.trim() !== "" || filtered.length > 0) && (
              <ul className="event-menu-suggest-list" role="listbox">
                <li>
                  <button
                    type="button"
                    className="event-menu-suggest-custom"
                    onClick={clearToCustom}
                  >
                    + Add custom dish (type name below)
                  </button>
                </li>
                {filtered.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="event-menu-suggest-item"
                      onClick={() => pickCatalog(row)}
                    >
                      <span className="event-menu-suggest-name">{row.name}</span>
                      <span className="event-menu-suggest-meta">
                        Menu ${(row.price_cents / 100).toFixed(2)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>
      </div>

      <div className="event-menu-option-fields">
        <div className="event-menu-fields-row">
          <label className="event-menu-field event-menu-field-name">
            <span>Name</span>
            <input
              type="text"
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="Dish name"
              required
            />
          </label>
          <div className="event-menu-remove-cell">
            <button
              type="button"
              className="btn-secondary btn-sm event-menu-remove-btn"
              onClick={onRemove}
            >
              Remove
            </button>
          </div>
        </div>
        <label className="event-menu-checkbox">
          <input
            type="checkbox"
            checked={value.isNewItem}
            onChange={(e) => onChange({ ...value, isNewItem: e.target.checked })}
          />
          <span>Show "New item!" to customers</span>
        </label>
      </div>
    </div>
  );
}

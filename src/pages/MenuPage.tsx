import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80";

type MenuCategoryRow = {
  id: string;
  name: string;
  sort_order: number | null;
};

type MenuItemRow = {
  id: string;
  name: string;
  name_chinese: string | null;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  sort_order: number | null;
  menu_categories: MenuCategoryRow | MenuCategoryRow[] | null;
};

function getCategory(row: MenuItemRow): MenuCategoryRow | null {
  const c = row.menu_categories;
  if (!c) return null;
  return Array.isArray(c) ? c[0] ?? null : c;
}

function formatPrice(cents: number): string {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

type BbqSubsection = {
  id: string;
  title: string;
  items: MenuItemRow[];
};

type BbqSection = {
  kind: "bbq";
  id: string;
  title: string;
  subtitle: string;
  subsections: BbqSubsection[];
};

type FlatSection = {
  kind: "flat";
  id: string;
  title: string;
  items: MenuItemRow[];
};

type MenuSection = BbqSection | FlatSection;

type NavLink = { kind: "link"; label: string; targetId: string };

type NavDropdown = {
  kind: "dropdown";
  label: string;
  overviewTargetId: string;
  options: { label: string; targetId: string }[];
};

type MenuNavItem = NavLink | NavDropdown;

function buildSections(items: MenuItemRow[]): MenuSection[] {
  const byCat = new Map<
    string,
    { cat: MenuCategoryRow; items: MenuItemRow[] }
  >();

  for (const item of items) {
    const cat = getCategory(item);
    if (!cat) continue;
    let entry = byCat.get(cat.id);
    if (!entry) {
      entry = { cat, items: [] };
      byCat.set(cat.id, entry);
    }
    entry.items.push(item);
  }

  const entries = [...byCat.values()].sort(
    (a, b) => (a.cat.sort_order ?? 0) - (b.cat.sort_order ?? 0),
  );
  for (const e of entries) {
    e.items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  const bbq: typeof entries = [];
  const rest: typeof entries = [];
  for (const e of entries) {
    if (e.cat.name.startsWith("Charcoal Grilled —")) bbq.push(e);
    else rest.push(e);
  }

  const sections: MenuSection[] = [];
  if (bbq.length) {
    sections.push({
      kind: "bbq",
      id: "menu-bbq",
      title: "BBQ",
      subtitle: "Charcoal Grilled",
      subsections: bbq.map((e) => ({
        id: `menu-bbq-${e.cat.id}`,
        title: e.cat.name.replace(/^Charcoal Grilled — /, ""),
        items: e.items,
      })),
    });
  }
  for (const e of rest) {
    sections.push({
      kind: "flat",
      id: `menu-cat-${e.cat.id}`,
      title: e.cat.name,
      items: e.items,
    });
  }
  return sections;
}

function buildMenuNav(sections: MenuSection[]): MenuNavItem[] {
  const nav: MenuNavItem[] = [];
  let i = 0;
  while (i < sections.length) {
    const s = sections[i];
    if (s.kind === "bbq") {
      nav.push({
        kind: "dropdown",
        label: "BBQ",
        overviewTargetId: s.id,
        options: s.subsections.map((sub) => ({
          label: sub.title,
          targetId: sub.id,
        })),
      });
      i += 1;
      continue;
    }
    if (
      s.kind === "flat" &&
      s.title.startsWith("American Favorites —")
    ) {
      const flats: FlatSection[] = [];
      while (
        i < sections.length &&
        sections[i].kind === "flat" &&
        (sections[i] as FlatSection).title.startsWith("American Favorites —")
      ) {
        flats.push(sections[i] as FlatSection);
        i += 1;
      }
      const first = flats[0];
      if (first) {
        nav.push({
          kind: "dropdown",
          label: "American Favorites",
          overviewTargetId: first.id,
          options: flats.map((f) => ({
            label: f.title.replace(/^American Favorites — /, ""),
            targetId: f.id,
          })),
        });
      }
      continue;
    }
    if (s.kind === "flat" && s.title.startsWith("Specialty —")) {
      const flats: FlatSection[] = [];
      while (
        i < sections.length &&
        sections[i].kind === "flat" &&
        (sections[i] as FlatSection).title.startsWith("Specialty —")
      ) {
        flats.push(sections[i] as FlatSection);
        i += 1;
      }
      const first = flats[0];
      if (first) {
        nav.push({
          kind: "dropdown",
          label: "Specialty",
          overviewTargetId: first.id,
          options: flats.map((f) => ({
            label: f.title.replace(/^Specialty — /, ""),
            targetId: f.id,
          })),
        });
      }
      continue;
    }
    if (s.kind === "flat") {
      nav.push({ kind: "link", label: s.title, targetId: s.id });
      i += 1;
    }
  }
  return nav;
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}


export default function MenuPage() {
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: qerr } = await supabase
          .from("menu_items")
          .select(
            "id,name,name_chinese,description,price_cents,image_url,sort_order,menu_categories(id,name,sort_order)",
          )
          .eq("is_available", true)
          .order("sort_order", { ascending: true });

        if (qerr) throw qerr;
        if (cancelled) return;
        const rows = (data ?? []) as MenuItemRow[];
        setSections(buildSections(rows));
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load menu.");
          setSections([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const menuNav = useMemo(() => buildMenuNav(sections), [sections]);

  // Close open dropdown when clicking outside the nav bar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <main className="page-content">
      <div className="container" id="container-top">
        <h1 className="page-title" id="menu-title">
          Menu
        </h1>
        <button
          type="button"
          className="scroll-to-top-btn"
          onClick={() => scrollToSection("container-top")}
        >
          <span className="material-symbols-outlined sym">arrow_upward</span>
          Back to top
        </button>

        <nav className="menu-nav-bar" aria-label="Menu sections" ref={navRef}>
          {menuNav.map((item) =>
            item.kind === "link" ? (
              <button
                key={item.targetId}
                type="button"
                className="menu-nav-link"
                onClick={() => scrollToSection(item.targetId)}
              >
                {item.label}
              </button>
            ) : (
              <div key={item.label} className="menu-nav-dropdown">
                <button
                  type="button"
                  className={`menu-nav-dropdown-summary${openDropdown === item.label ? " open" : ""}`}
                  aria-expanded={openDropdown === item.label}
                  onClick={() =>
                    setOpenDropdown(openDropdown === item.label ? null : item.label)
                  }
                >
                  {item.label}
                  <span className="menu-nav-chevron" aria-hidden>▾</span>
                </button>
                {openDropdown === item.label && (
                  <div className="menu-nav-dropdown-panel">
                    <button
                      type="button"
                      className="menu-nav-dropdown-item menu-nav-dropdown-overview"
                      onClick={() => { scrollToSection(item.overviewTargetId); setOpenDropdown(null); }}
                    >
                      View all
                    </button>
                    {item.options.map((opt) => (
                      <button
                        key={opt.targetId}
                        type="button"
                        className="menu-nav-dropdown-item"
                        onClick={() => { scrollToSection(opt.targetId); setOpenDropdown(null); }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
        </nav>

        {loading && <p className="menu-loading">Loading menu…</p>}
        {error && (
          <p className="menu-error" role="alert">
            {error}
          </p>
        )}

        <div className="menu-sections">
          {!loading &&
            !error &&
            sections.map((section) =>
              section.kind === "bbq" ? (
                <div
                  key={section.id}
                  id={section.id}
                  className="menu-section-row"
                >
                  <div className="menu-section-heading">
                    <h2 className="menu-section-title">{section.title}</h2>
                    <p className="menu-section-subtitle">{section.subtitle}</p>
                  </div>
                  <div className="menu-section-stack">
                    {section.subsections.map((sub) => (
                      <div
                        key={sub.id}
                        id={sub.id}
                        className="menu-bbq-subsection"
                      >
                        <h3 className="menu-subsection-title">{sub.title}</h3>
                        <div className="menu-section-items">
                          {sub.items.map((menuItem) => (
                            <div key={menuItem.id} className="menu-item-card">
                              <div
                                className="menu-item-image"
                                style={{
                                  backgroundImage: `url(${menuItem.image_url || PLACEHOLDER_IMG})`,
                                }}
                              />
                              <div className="menu-item-info">
                                <h3>{menuItem.name}</h3>
                                {menuItem.name_chinese && (
                                  <p className="menu-item-chinese">
                                    {menuItem.name_chinese}
                                  </p>
                                )}
                                <span className="menu-item-price">
                                  {formatPrice(menuItem.price_cents)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  key={section.id}
                  id={section.id}
                  className="menu-section-row"
                >
                  <div className="menu-section-heading">
                    <h2 className="menu-section-title">{section.title}</h2>
                  </div>
                  <div className="menu-section-items">
                    {section.items.map((menuItem) => (
                      <div key={menuItem.id} className="menu-item-card">
                        <div
                          className="menu-item-image"
                          style={{
                            backgroundImage: `url(${menuItem.image_url || PLACEHOLDER_IMG})`,
                          }}
                        />
                        <div className="menu-item-info">
                          <h3>{menuItem.name}</h3>
                          {menuItem.name_chinese && (
                            <p className="menu-item-chinese">
                              {menuItem.name_chinese}
                            </p>
                          )}
                          <span className="menu-item-price">
                            {formatPrice(menuItem.price_cents)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
        </div>
      </div>
    </main>
  );
}

import * as React from "react";
import { useCombobox } from "../headless-hydra";
import { type CityOption } from "../data/cities";
import { searchCitiesRemote } from "../data/mockApi";
import { isoToFlagEmoji, formatPopulation } from "../utils/flag";
import "./command-palette-skin.css";

const itemToString = (item: CityOption | null) =>
  item ? `${item.city}, ${item.country}` : "";
const itemToId = (item: CityOption) => item.id;

export function CommandPaletteSkin() {
  const [isPaletteOpen, setIsPaletteOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const combobox = useCombobox<CityOption>({
    id: "compare-cities",
    fetchOptions: searchCitiesRemote,
    debounceMs: 300,
    itemToString,
    itemToId,
    multiSelect: true,
    initialIsOpen: true,
  });

  const {
    options,
    highlightedIndex,
    isLoading,
    isEmpty,
    error,
    selectedItems,
    removeSelectedItem,
    getInputProps,
    getListProps,
    getOptionProps,
  } = combobox;

  // Global ⌘K / Ctrl+K shortcut to open the palette.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape") setIsPaletteOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    if (isPaletteOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [isPaletteOpen]);

  const isSelected = (item: CityOption) =>
    selectedItems.some((i) => i.id === item.id);

  return (
    <div className="cps-wrap">
      <button
        type="button"
        className="cps-trigger"
        onClick={() => setIsPaletteOpen(true)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Compare cities…
        <kbd className="cps-kbd">⌘K</kbd>
      </button>

      {selectedItems.length > 0 && (
        <div className="cps-chips">
          {selectedItems.map((item) => (
            <span className="cps-chip" key={item.id}>
              {isoToFlagEmoji(item.iso2)} {item.city}
              <button
                type="button"
                className="cps-chip-remove"
                aria-label={`Remove ${item.city}`}
                onClick={() => removeSelectedItem(item)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {isPaletteOpen && (
        <div
          className="cps-overlay"
          onClick={() => setIsPaletteOpen(false)}
        >
          <div
            className="cps-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Compare cities"
          >
            <div className="cps-search-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                className="cps-input"
                placeholder="Search any city in the world…"
                {...getInputProps<HTMLInputElement>({ ref: inputRef })}
              />
              {isLoading && <span className="cps-spinner" aria-hidden="true" />}
            </div>

            <div className="cps-body" {...getListProps()}>
              {error && <div className="cps-status">Something went wrong: {error}</div>}

              {!error && isLoading && options.length === 0 && (
                <div className="cps-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="cps-card cps-card--skeleton" key={i} />
                  ))}
                </div>
              )}

              {!error && isEmpty && (
                <div className="cps-status">No cities found. Try another search.</div>
              )}

              {!error && options.length > 0 && (
                <div className="cps-grid">
                  {options.map((item, index) => (
                    <div
                      key={item.id}
                      className={
                        "cps-card" +
                        (index === highlightedIndex ? " cps-card--active" : "") +
                        (isSelected(item) ? " cps-card--selected" : "")
                      }
                      {...getOptionProps(index, item)}
                    >
                      <div className="cps-card-top">
                        <span className="cps-card-flag" aria-hidden="true">
                          {isoToFlagEmoji(item.iso2)}
                        </span>
                        {isSelected(item) && (
                          <span className="cps-card-check" aria-hidden="true">
                            ✓
                          </span>
                        )}
                      </div>
                      <div className="cps-card-city">{item.city}</div>
                      <div className="cps-card-country">
                        {item.admin ? `${item.admin}, ` : ""}
                        {item.country}
                      </div>
                      <div className="cps-card-pop">
                        {formatPopulation(item.population)} people
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="cps-footer">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>Enter</kbd> toggle select
              </span>
              <span>
                <kbd>Esc</kbd> close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

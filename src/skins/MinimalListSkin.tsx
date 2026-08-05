import { useCombobox } from "../headless-hydra";
import { CITIES, type CityOption } from "../data/cities";
import { isoToFlagEmoji } from "../utils/flag";
import "./minimal-list-skin.css";

const itemToString = (item: CityOption | null) =>
  item ? `${item.city}, ${item.country}` : "";
const itemToId = (item: CityOption) => item.id;

export function MinimalListSkin() {
  const combobox = useCombobox<CityOption>({
    id: "from-city",
    items: CITIES,
    itemToString,
    itemToId,
    initialInputValue: "",
  });

  const {
    isOpen,
    options,
    highlightedIndex,
    isEmpty,
    selectedItem,
    getLabelProps,
    getInputProps,
    getListProps,
    getOptionProps,
  } = combobox;

  return (
    <div className="mls-field">
      <label className="mls-label" {...getLabelProps()}>
        From
      </label>
      <div className="mls-input-wrap">
        <svg
          className="mls-pin"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <input
          className="mls-input"
          placeholder="Departure city or airport"
          {...getInputProps<HTMLInputElement>()}
        />
        {selectedItem && (
          <span className="mls-flag" aria-hidden="true">
            {isoToFlagEmoji(selectedItem.iso2)}
          </span>
        )}
      </div>

      {isOpen && (
        <ul className="mls-list" {...getListProps()}>
          {options.slice(0, 12).map((item, index) => (
            <li
              key={item.id}
              className={
                "mls-option" +
                (index === highlightedIndex ? " mls-option--active" : "")
              }
              {...getOptionProps(index, item)}
            >
              <span className="mls-option-flag" aria-hidden="true">
                {isoToFlagEmoji(item.iso2)}
              </span>
              <span className="mls-option-text">
                <span className="mls-option-city">{item.city}</span>
                <span className="mls-option-meta">
                  {item.admin ? `${item.admin}, ` : ""}
                  {item.country}
                </span>
              </span>
            </li>
          ))}
          {isEmpty && (
            <li className="mls-empty" role="presentation">
              No cities match “{combobox.inputValue}”.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

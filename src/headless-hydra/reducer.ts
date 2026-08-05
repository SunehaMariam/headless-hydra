import type { ComboboxAction, ComboboxState } from "./types";
export function comboboxReducer<TItem>(
  state: ComboboxState<TItem>,
  action: ComboboxAction<TItem>,
): ComboboxState<TItem> {
  switch (action.type) {
    case "INPUT_CHANGE":
      return {
        ...state,
        inputValue: action.value,
        isOpen: true,
        highlightedIndex: -1,
      };

    case "OPEN":
      return state.isOpen ? state : { ...state, isOpen: true };

    case "CLOSE":
      return {
        ...state,
        isOpen: false,
        highlightedIndex: -1,
        inputValue:
          action.restoreValue !== undefined
            ? action.restoreValue
            : state.inputValue,
      };

    case "SET_HIGHLIGHT":
      return { ...state, highlightedIndex: action.index };

    case "MOVE_HIGHLIGHT": {
      if (action.optionCount === 0) return state;
      const next = state.highlightedIndex + action.direction;
      // Clamp at boundaries (documented choice — see README).
      const clamped = Math.max(0, Math.min(action.optionCount - 1, next));
      return { ...state, isOpen: true, highlightedIndex: clamped };
    }

    case "HOME":
      if (action.optionCount === 0) return state;
      return { ...state, highlightedIndex: 0 };

    case "END":
      if (action.optionCount === 0) return state;
      return { ...state, highlightedIndex: action.optionCount - 1 };

    case "SELECT_ITEM": {
      const { item, itemToString, itemToId, multiSelect } = action;
      if (multiSelect) {
        const exists = state.selectedItems.some(
          (i) => itemToId(i) === itemToId(item),
        );
        const selectedItems = exists
          ? state.selectedItems.filter((i) => itemToId(i) !== itemToId(item))
          : [...state.selectedItems, item];
        return {
          ...state,
          selectedItems,
          inputValue: "",
          isOpen: true,
          highlightedIndex: -1,
        };
      }
      return {
        ...state,
        selectedItems: [item],
        inputValue: itemToString(item),
        isOpen: false,
        highlightedIndex: -1,
      };
    }

    case "REMOVE_SELECTED": {
      const { itemId, itemToId } = action;
      return {
        ...state,
        selectedItems: state.selectedItems.filter(
          (i) => itemToId(i) !== itemId,
        ),
      };
    }

    case "RESET_HIGHLIGHT":
      return { ...state, highlightedIndex: -1 };

    case "SYNC_EXTERNAL":
      return {
        ...state,
        inputValue: action.inputValue ?? state.inputValue,
        isOpen: action.isOpen ?? state.isOpen,
      };

    default:
      return state;
  }
}

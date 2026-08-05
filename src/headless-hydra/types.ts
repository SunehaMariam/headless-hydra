import type * as React from "react"
export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface AsyncState<TItem> {
  status: AsyncStatus;
  options: TItem[];
  error: string | null;
}


export type FetchOptionsFn<TItem> = (
  query: string,
  signal: AbortSignal,
) => Promise<TItem[]>;


export interface ItemHelpers<TItem> {
 
  itemToString: (item: TItem | null) => string;
 
  itemToId: (item: TItem) => string;
}


export interface UseComboboxBaseOptions<TItem> extends ItemHelpers<TItem> {
  
  items?: TItem[];
 
  fetchOptions?: FetchOptionsFn<TItem>;
  /** Debounce window (ms) before an async fetch fires. Default 300ms. */
  debounceMs?: number;
  /** Custom filter for sync mode. Defaults to case-insensitive substring match. */
  filterFn?: (item: TItem, query: string) => boolean;
  /** Multi-select mode. Default false (single-select). */
  multiSelect?: boolean;
  /** Called whenever the committed selection changes. */
  onSelectionChange?: (selected: TItem[]) => void;
  /** Called whenever the input value changes (every keystroke). */
  onInputValueChange?: (value: string) => void;
  /** Initial input value for uncontrolled mode. */
  initialInputValue?: string;
  /** Initial selection for uncontrolled mode. */
  initialSelectedItems?: TItem[];
  /** Initial open state for uncontrolled mode. */
  initialIsOpen?: boolean;
  /** id used to build stable DOM ids (input, listbox, options, label). */
  id?: string;
}

/** Controlled-mode extension: consumer owns input value + selection. */
export interface UseComboboxControlledOptions<TItem>
  extends UseComboboxBaseOptions<TItem> {
  inputValue: string;
  selectedItems: TItem[];
  isOpen?: boolean;
  onIsOpenChange?: (isOpen: boolean) => void;
}

export type UseComboboxOptions<TItem> =
  | UseComboboxBaseOptions<TItem>
  | UseComboboxControlledOptions<TItem>;

export function isControlled<TItem>(
  opts: UseComboboxOptions<TItem>,
): opts is UseComboboxControlledOptions<TItem> {
  return (
    (opts as UseComboboxControlledOptions<TItem>).inputValue !== undefined &&
    (opts as UseComboboxControlledOptions<TItem>).selectedItems !== undefined
  );
}

export interface ComboboxState<TItem> {
  inputValue: string;
  isOpen: boolean;
  highlightedIndex: number;
  selectedItems: TItem[];
}

export type ComboboxAction<TItem> =
  | { type: "INPUT_CHANGE"; value: string }
  | { type: "OPEN" }
  | { type: "CLOSE"; restoreValue?: string }
  | { type: "SET_HIGHLIGHT"; index: number }
  | { type: "MOVE_HIGHLIGHT"; direction: 1 | -1; optionCount: number }
  | { type: "HOME"; optionCount: number }
  | { type: "END"; optionCount: number }
  | {
      type: "SELECT_ITEM";
      item: TItem;
      itemToString: (item: TItem | null) => string;
      itemToId: (item: TItem) => string;
      multiSelect: boolean;
    }
  | { type: "REMOVE_SELECTED"; itemId: string; itemToId: (item: TItem) => string }
  | { type: "RESET_HIGHLIGHT" }
  | { type: "SYNC_EXTERNAL"; inputValue?: string; isOpen?: boolean };

/** Everything a prop-getter needs merged in from the consumer. */
export interface GetInputPropsOptions<TElement = HTMLInputElement>
  extends React.HTMLAttributes<TElement> {
  ref?: React.Ref<TElement>;
}
export interface GetListProps<TElement = HTMLElement>
  extends React.HTMLAttributes<TElement> {
  ref?: React.Ref<TElement>;
}
export interface GetOptionProps<TElement = HTMLElement>
  extends React.HTMLAttributes<TElement> {
  ref?: React.Ref<TElement>;
}
export interface GetLabelProps<TElement = HTMLLabelElement>
  extends React.HTMLAttributes<TElement> {
  ref?: React.Ref<TElement>;
}

export interface UseComboboxResult<TItem> {
  // ----- state -----
  inputValue: string;
  isOpen: boolean;
  highlightedIndex: number;
  selectedItem: TItem | null;
  selectedItems: TItem[];
  options: TItem[];
  isLoading: boolean;
  isEmpty: boolean;
  error: string | null;

  // ----- imperative actions (for consumers who want them directly) -----
  openMenu: () => void;
  closeMenu: () => void;
  setInputValue: (value: string) => void;
  selectItem: (item: TItem) => void;
  removeSelectedItem: (item: TItem) => void;

  // ----- prop getters -----
  getLabelProps: <T = HTMLLabelElement>(
    props?: GetLabelProps<T>,
  ) => React.HTMLAttributes<T> & { htmlFor: string };
  getInputProps: <T = HTMLInputElement>(
    props?: GetInputPropsOptions<T>,
  ) => React.InputHTMLAttributes<T> & { ref?: React.Ref<T> };
  getListProps: <T = HTMLElement>(
    props?: GetListProps<T>,
  ) => React.HTMLAttributes<T>;
  getOptionProps: <T = HTMLElement>(
    index: number,
    item: TItem,
    props?: GetOptionProps<T>,
  ) => React.HTMLAttributes<T>;
}

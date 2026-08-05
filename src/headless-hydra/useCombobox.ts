import * as React from "react";
import { comboboxReducer } from "./reducer";
import {
  isControlled,
  type ComboboxState,
  type UseComboboxOptions,
  type UseComboboxResult,
  type GetInputPropsOptions,
  type GetListProps,
  type GetOptionProps,
  type GetLabelProps,
} from "./types";

const DEFAULT_DEBOUNCE_MS = 300;

function defaultFilterFn<TItem>(
  itemToString: (item: TItem | null) => string,
) {
  return (item: TItem, query: string) =>
    itemToString(item).toLowerCase().includes(query.toLowerCase());
}

/** Merge a consumer-supplied handler with our internal one — both fire, consumer never gets silently overwritten. */
function callAll<E>(
  ...fns: Array<((event: E) => void) | undefined>
): (event: E) => void {
  return (event: E) => {
    for (const fn of fns) {
      if (fn) fn(event);
    }
  };
}

let idSeed = 0;
function useStableId(providedId?: string): string {
  const generated = React.useRef<string | undefined>(undefined);
  if (!generated.current) {
    idSeed += 1;
    generated.current = providedId ?? `hh-${idSeed}`;
  }
  return providedId ?? generated.current;
}

export function useCombobox<TItem>(
  opts: UseComboboxOptions<TItem>,
): UseComboboxResult<TItem> {
  const {
    items,
    fetchOptions,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    filterFn,
    multiSelect = false,
    itemToString,
    itemToId,
    onSelectionChange,
    onInputValueChange,
  } = opts;

  const controlled = isControlled(opts);
  const baseId = useStableId(opts.id);

  const [state, dispatch] = React.useReducer(
    comboboxReducer<TItem>,
    {
      inputValue: controlled
        ? opts.inputValue
        : opts.initialInputValue ?? "",
      isOpen: controlled
        ? opts.isOpen ?? false
        : opts.initialIsOpen ?? false,
      highlightedIndex: -1,
      selectedItems: controlled
        ? opts.selectedItems
        : opts.initialSelectedItems ?? [],
    } as ComboboxState<TItem>,
  );

  // Keep internal state in sync when running in controlled mode.
  React.useEffect(() => {
    if (!controlled) return;
    dispatch({
      type: "SYNC_EXTERNAL",
      inputValue: opts.inputValue,
      isOpen: opts.isOpen,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled, controlled ? opts.inputValue : null, controlled ? opts.isOpen : null]);

  const inputValue = controlled ? opts.inputValue : state.inputValue;
  const selectedItems = controlled ? opts.selectedItems : state.selectedItems;
  const isOpen = controlled ? opts.isOpen ?? state.isOpen : state.isOpen;

  // ---------------------------------------------------------------------
  // Async data source: debounce + abort + out-of-order guard.
  // ---------------------------------------------------------------------
  const isAsync = typeof fetchOptions === "function";
  const [asyncOptions, setAsyncOptions] = React.useState<TItem[]>([]);
  const [asyncStatus, setAsyncStatus] = React.useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [asyncError, setAsyncError] = React.useState<string | null>(null);

  const requestIdRef = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  React.useEffect(() => {
    if (!isAsync || !fetchOptions) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      const thisRequestId = ++requestIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setAsyncStatus("loading");
      setAsyncError(null);

      fetchOptions(inputValue, controller.signal)
        .then((results) => {
          // Out-of-order guard: only the latest request may write state.
          if (thisRequestId !== requestIdRef.current) return;
          setAsyncOptions(results);
          setAsyncStatus("success");
        })
        .catch((err: unknown) => {
          if (thisRequestId !== requestIdRef.current) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          setAsyncStatus("error");
          setAsyncError(err instanceof Error ? err.message : "Unknown error");
        });
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, isAsync, debounceMs]);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // ---------------------------------------------------------------------
  // Sync filtering (memoized so identical results keep referential
  // stability and don't force the whole list to re-render).
  // ---------------------------------------------------------------------
  const effectiveFilter = React.useMemo(
    () => filterFn ?? defaultFilterFn(itemToString),
    [filterFn, itemToString],
  );

  const syncOptions = React.useMemo(() => {
    if (isAsync || !items) return [];
    if (!inputValue) return items;
    return items.filter((item) => effectiveFilter(item, inputValue));
  }, [isAsync, items, inputValue, effectiveFilter]);

  const options = isAsync ? asyncOptions : syncOptions;
  const isLoading = isAsync && asyncStatus === "loading";
  const isEmpty = isOpen && !isLoading && options.length === 0;
  const error = isAsync ? asyncError : null;

  // ---------------------------------------------------------------------
  // Imperative actions
  // ---------------------------------------------------------------------
  const setInputValue = React.useCallback(
    (value: string) => {
      dispatch({ type: "INPUT_CHANGE", value });
      onInputValueChange?.(value);
    },
    [onInputValueChange],
  );

  const openMenu = React.useCallback(() => dispatch({ type: "OPEN" }), []);
  const closeMenu = React.useCallback(
    () => dispatch({ type: "CLOSE" }),
    [],
  );

  const selectItem = React.useCallback(
    (item: TItem) => {
      dispatch({
        type: "SELECT_ITEM",
        item,
        itemToString,
        itemToId,
        multiSelect,
      });
      if (multiSelect) {
        const exists = selectedItems.some(
          (i) => itemToId(i) === itemToId(item),
        );
        const next = exists
          ? selectedItems.filter((i) => itemToId(i) !== itemToId(item))
          : [...selectedItems, item];
        onSelectionChange?.(next);
      } else {
        onSelectionChange?.([item]);
      }
    },
    [itemToString, itemToId, multiSelect, selectedItems, onSelectionChange],
  );

  const removeSelectedItem = React.useCallback(
    (item: TItem) => {
      dispatch({ type: "REMOVE_SELECTED", itemId: itemToId(item), itemToId });
      onSelectionChange?.(
        selectedItems.filter((i) => itemToId(i) !== itemToId(item)),
      );
    },
    [itemToId, selectedItems, onSelectionChange],
  );

  // ---------------------------------------------------------------------
  // Keyboard handling — lives in one place so both sync + async options
  // behave identically regardless of where `options` came from.
  // ---------------------------------------------------------------------
  const optionsRef = React.useRef(options);
  optionsRef.current = options;
  const highlightedIndexRef = React.useRef(state.highlightedIndex);
  highlightedIndexRef.current = state.highlightedIndex;

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const optionCount = optionsRef.current.length;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          dispatch({ type: "MOVE_HIGHLIGHT", direction: 1, optionCount });
          break;
        case "ArrowUp":
          event.preventDefault();
          dispatch({ type: "MOVE_HIGHLIGHT", direction: -1, optionCount });
          break;
        case "Home":
          if (isOpen) {
            event.preventDefault();
            dispatch({ type: "HOME", optionCount });
          }
          break;
        case "End":
          if (isOpen) {
            event.preventDefault();
            dispatch({ type: "END", optionCount });
          }
          break;
        case "Enter": {
          const idx = highlightedIndexRef.current;
          const item = optionsRef.current[idx];
          if (isOpen && idx >= 0 && idx < optionCount && item) {
            event.preventDefault();
            selectItem(item);
          }
          break;
        }
        case "Escape":
          if (isOpen) {
            event.preventDefault();
            dispatch({
              type: "CLOSE",
              restoreValue: controlled
                ? undefined
                : itemToString(selectedItems[0] ?? null),
            });
          }
          break;
        case "Tab": {
          const idx = highlightedIndexRef.current;
          const item = optionsRef.current[idx];
          if (isOpen && idx >= 0 && idx < optionCount && item) {
            selectItem(item);
          } else if (isOpen) {
            dispatch({ type: "CLOSE" });
          }
          // Intentionally no preventDefault — focus moves onward natively.
          break;
        }
        default:
          break;
      }
    },
    [isOpen, selectItem, controlled, itemToString, selectedItems],
  );

  // ---------------------------------------------------------------------
  // Prop getters
  // ---------------------------------------------------------------------
  const listboxId = `${baseId}-listbox`;
  const inputId = `${baseId}-input`;
  const labelId = `${baseId}-label`;
  const getOptionId = React.useCallback(
    (index: number) => `${baseId}-option-${index}`,
    [baseId],
  );

  const getLabelProps = React.useCallback(
    <T = HTMLLabelElement,>(props: GetLabelProps<T> = {}) => ({
      ...props,
      id: labelId,
      htmlFor: inputId,
    }),
    [labelId, inputId],
  );

  const getInputProps = React.useCallback(
    <T = HTMLInputElement,>(
      props: GetInputPropsOptions<T> = {},
    ): React.InputHTMLAttributes<T> & { ref?: React.Ref<T> } => {
      const { onChange, onKeyDown, onFocus, ...rest } = props;
      return {
        ...rest,
        id: inputId,
        role: "combobox",
        "aria-autocomplete": "list",
        "aria-expanded": isOpen,
        "aria-controls": listboxId,
        "aria-activedescendant":
          isOpen && state.highlightedIndex >= 0
            ? getOptionId(state.highlightedIndex)
            : undefined,
        "aria-labelledby": labelId,
        autoComplete: "off",
        value: inputValue,
        onChange: callAll<React.ChangeEvent<T>>(
          (e) => setInputValue((e.target as unknown as HTMLInputElement).value),
          onChange as (e: React.ChangeEvent<T>) => void,
        ),
        onKeyDown: callAll<React.KeyboardEvent<T>>(
          handleKeyDown as unknown as (e: React.KeyboardEvent<T>) => void,
          onKeyDown as (e: React.KeyboardEvent<T>) => void,
        ),
        onFocus: callAll<React.FocusEvent<T>>(
          () => dispatch({ type: "OPEN" }),
          onFocus as (e: React.FocusEvent<T>) => void,
        ),
      } as React.InputHTMLAttributes<T> & { ref?: React.Ref<T> };
    },
    [
      inputId,
      isOpen,
      listboxId,
      labelId,
      state.highlightedIndex,
      getOptionId,
      inputValue,
      setInputValue,
      handleKeyDown,
    ],
  );

  const getListProps = React.useCallback(
    <T = HTMLElement,>(props: GetListProps<T> = {}): React.HTMLAttributes<T> => {
      const { ...rest } = props;
      return {
        ...rest,
        id: listboxId,
        role: "listbox",
        "aria-labelledby": labelId,
      };
    },
    [listboxId, labelId],
  );

  const getOptionProps = React.useCallback(
    <T = HTMLElement,>(
      index: number,
      item: TItem,
      props: GetOptionProps<T> = {},
    ): React.HTMLAttributes<T> => {
      const { onClick, onMouseEnter, ...rest } = props;
      const isSelected = selectedItems.some(
        (i) => itemToId(i) === itemToId(item),
      );
      return {
        ...rest,
        id: getOptionId(index),
        role: "option",
        "aria-selected": isSelected,
        "aria-posinset": index + 1,
        "aria-setsize": options.length,
        onClick: callAll<React.MouseEvent<T>>(
          () => selectItem(item),
          onClick as (e: React.MouseEvent<T>) => void,
        ),
        onMouseEnter: callAll<React.MouseEvent<T>>(
          () => dispatch({ type: "SET_HIGHLIGHT", index }),
          onMouseEnter as (e: React.MouseEvent<T>) => void,
        ),
      };
    },
    [selectedItems, itemToId, getOptionId, options.length, selectItem],
  );

  return {
    inputValue,
    isOpen,
    highlightedIndex: state.highlightedIndex,
    selectedItem: selectedItems[0] ?? null,
    selectedItems,
    options,
    isLoading,
    isEmpty,
    error,

    openMenu,
    closeMenu,
    setInputValue,
    selectItem,
    removeSelectedItem,

    getLabelProps,
    getInputProps,
    getListProps,
    getOptionProps,
  };
}

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import type {
  AcpModelOption,
  AcpModelSelection,
} from '../../../shared/main-process-api-interfaces/AcpAPI';

export interface ACPModelPickerProps {
  selection: AcpModelSelection;
  disabled?: boolean;
  error?: string;
  onChange: (model: string) => void;
}

/**
 * Searchable model picker for the pre-conversation empty state.
 *
 * OpenCode can advertise hundreds of models, so the list is filtered as the
 * user types and supports arrow-key navigation over the visible results.
 */
export function ACPModelPicker({
  selection,
  disabled = false,
  error,
  onChange,
}: ACPModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const optionIdPrefix = useId();

  const current = selection.options.find(
    (option) => option.value === selection.currentValue,
  );

  const filteredGroups = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const groups = new Map<string, AcpModelOption[]>();
    for (const option of selection.options) {
      if (
        term &&
        !`${option.provider} ${option.name} ${option.value}`
          .toLocaleLowerCase()
          .includes(term)
      ) {
        continue;
      }
      const existing = groups.get(option.provider);
      if (existing) existing.push(option);
      else groups.set(option.provider, [option]);
    }
    return [...groups.entries()];
  }, [query, selection.options]);

  const filtered = useMemo(
    () => filteredGroups.flatMap(([, options]) => options),
    [filteredGroups],
  );

  const indexByValue = useMemo(
    () => new Map(filtered.map((option, index) => [option.value, index])),
    [filtered],
  );

  useEffect(() => {
    if (!open) return undefined;
    searchRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    resultsRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const closePicker = (restoreFocus = false) => {
    setOpen(false);
    setQuery('');
    if (restoreFocus) triggerRef.current?.focus();
  };

  const openPicker = () => {
    if (disabled) return;
    const currentIndex = selection.options.findIndex(
      (option) => option.value === selection.currentValue,
    );
    setQuery('');
    setActiveIndex(currentIndex >= 0 ? currentIndex : 0);
    setOpen(true);
  };

  const choose = (option: AcpModelOption) => {
    closePicker(true);
    onChange(option.value);
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) =>
          filtered.length === 0 ? 0 : Math.min(index + 1, filtered.length - 1),
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(Math.max(filtered.length - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const option = filtered[activeIndex];
        if (option) choose(option);
        break;
      }
      case 'Escape':
        event.preventDefault();
        closePicker(true);
        break;
      case 'Tab':
        closePicker();
        break;
      default:
        break;
    }
  };

  const activeOption = filtered[activeIndex];

  return (
    <div className="acp-model-picker" ref={wrapperRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Model: ${current?.name ?? selection.currentValue}`}
        className="acp-model-picker__trigger"
        disabled={disabled}
        onClick={() => (open ? closePicker() : openPicker())}
        ref={triggerRef}
        type="button"
      >
        <span className="acp-model-picker__current">
          <span className="acp-model-picker__provider">
            {current?.provider ?? 'Model'}
          </span>
          <strong>{current?.name ?? selection.currentValue}</strong>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>

      {open ? (
        <div className="acp-model-picker__popover">
          <div className="acp-model-picker__search">
            <Search size={14} aria-hidden="true" />
            <input
              aria-activedescendant={
                activeOption
                  ? `${optionIdPrefix}-${indexByValue.get(activeOption.value)}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={open}
              aria-label="Search models"
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search models…"
              ref={searchRef}
              role="combobox"
              type="text"
              value={query}
            />
            <span className="acp-model-picker__count" aria-hidden="true">
              {filtered.length}
            </span>
          </div>

          <div
            aria-label="Models"
            className="acp-model-picker__results"
            id={listboxId}
            ref={resultsRef}
            role="listbox"
          >
            {filtered.length === 0 ? (
              <div className="acp-model-picker__empty" role="status">
                No models match “{query.trim()}”.
              </div>
            ) : (
              filteredGroups.map(([provider, options]) => (
                <div aria-label={provider} key={provider} role="group">
                  <div
                    aria-hidden="true"
                    className="acp-model-picker__group-label"
                  >
                    {provider}
                  </div>
                  {options.map((option) => {
                    const index = indexByValue.get(option.value) ?? 0;
                    const isCurrent = option.value === selection.currentValue;
                    return (
                      <div
                        aria-selected={isCurrent}
                        className="acp-model-picker__option"
                        data-active={index === activeIndex}
                        id={`${optionIdPrefix}-${index}`}
                        key={option.value}
                        onClick={() => choose(option)}
                        onMouseEnter={() => setActiveIndex(index)}
                        role="option"
                        title={option.description}
                      >
                        <span className="acp-model-picker__option-name">
                          {option.name}
                        </span>
                        {isCurrent ? (
                          <Check size={13} aria-hidden="true" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {error ? (
        <small className="acp-session__model-picker-error" role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
}

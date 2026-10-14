import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Account, AccountType } from '../types';

export interface SearchableAccountSelectProps {
  accounts: Account[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
}

export const SearchableAccountSelect: React.FC<SearchableAccountSelectProps> = ({
  accounts = [],
  value,
  onChange,
  placeholder = 'Search & select account...',
  emptyOptionLabel,
  required = false,
  disabled = false,
  className = '',
  buttonClassName = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find currently selected account
  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === value);
  }, [accounts, value]);

  // Filter accounts based on search query
  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(acc => {
      const name = (acc.name || '').toLowerCase();
      const code = (acc.code || '').toLowerCase();
      const cell = (acc.cell || '').toLowerCase();
      const loc = (acc.location || '').toLowerCase();
      const type = (acc.type || '').toLowerCase();
      return name.includes(q) || code.includes(q) || cell.includes(q) || loc.includes(q) || type.includes(q);
    });
  }, [accounts, search]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(-1);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-account-item]');
      if (items[highlightedIndex]) {
        (items[highlightedIndex] as HTMLElement).scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (accId: string) => {
    onChange(accId);
    setIsOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    // When open
    const totalItems = (emptyOptionLabel ? 1 : 0) + filteredAccounts.length;

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0) {
        if (emptyOptionLabel && highlightedIndex === 0) {
          handleSelect('');
        } else {
          const itemIndex = emptyOptionLabel ? highlightedIndex - 1 : highlightedIndex;
          if (filteredAccounts[itemIndex]) {
            handleSelect(filteredAccounts[itemIndex].id);
          }
        }
      } else if (filteredAccounts.length === 1) {
        handleSelect(filteredAccounts[0].id);
      }
    }
  };

  const getAccountTypeBadge = (type?: AccountType) => {
    switch (type) {
      case AccountType.CUSTOMER:
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">Customer</span>;
      case AccountType.VENDOR:
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">Vendor</span>;
      case AccountType.CASH_BANK:
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">Cash/Bank</span>;
      case AccountType.REVENUE:
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">Revenue</span>;
      case AccountType.EXPENSE:
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300">Expense</span>;
      default:
        return null;
    }
  };

  const defaultButtonClass = "w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold outline-none text-slate-800 dark:text-slate-100 transition-all flex items-center justify-between";

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Hidden real input for HTML form validation */}
      {required && (
        <input
          type="text"
          value={value || ''}
          onChange={() => {}}
          required={required}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`${buttonClassName || defaultButtonClass} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500'}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate text-left mr-2 min-w-0 flex-1">
          {selectedAccount ? (
            <>
              {selectedAccount.code && (
                <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded shrink-0">
                  {selectedAccount.code}
                </span>
              )}
              <span className="truncate font-semibold text-slate-900 dark:text-white">
                {selectedAccount.name}
              </span>
              {selectedAccount.currency && (
                <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                  ({selectedAccount.currency})
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 font-normal truncate">
              {placeholder}
            </span>
          )}
        </div>

        {/* Dropdown Chevron / Clear */}
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {value && !required && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect('');
              }}
              className="p-1 hover:text-rose-500 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-xs"
              title="Clear selection"
            >
              ✕
            </span>
          )}
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-[200] mt-1.5 w-full min-w-[280px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 sticky top-0 z-10">
            <div className="relative flex items-center">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search account name or code..."
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="mt-1.5 px-1 flex justify-between items-center text-[10px] text-slate-400 font-medium">
              <span>{filteredAccounts.length} accounts found</span>
              <span className="text-[9px]">Use ↑↓ arrows & Enter</span>
            </div>
          </div>

          {/* Account Options List */}
          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1"
            role="listbox"
          >
            {/* Empty / None Option if allowed */}
            {emptyOptionLabel && (
              <div
                data-account-item
                onClick={() => handleSelect('')}
                className={`p-2.5 rounded-xl cursor-pointer text-xs font-bold transition-colors flex items-center justify-between ${
                  highlightedIndex === 0
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                } ${!value ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-black' : ''}`}
              >
                <span>{emptyOptionLabel}</span>
                {!value && <span className="text-emerald-600 font-bold">✓</span>}
              </div>
            )}

            {filteredAccounts.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  No accounts found matching "{search}"
                </p>
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              filteredAccounts.map((account, idx) => {
                const isSelected = account.id === value;
                const actualIndex = emptyOptionLabel ? idx + 1 : idx;
                const isHighlighted = highlightedIndex === actualIndex;

                return (
                  <div
                    key={account.id}
                    data-account-item
                    onClick={() => handleSelect(account.id)}
                    className={`p-2.5 rounded-xl cursor-pointer text-xs transition-colors flex items-center justify-between gap-2 ${
                      isHighlighted
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200'
                        : isSelected
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {account.code && (
                          <span className="text-[10px] font-mono font-semibold px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                            {account.code}
                          </span>
                        )}
                        <span className="truncate font-bold text-slate-900 dark:text-white">
                          {account.name}
                        </span>
                        {getAccountTypeBadge(account.type)}
                      </div>
                      {(account.cell || account.location) && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {account.cell && <span>📞 {account.cell} </span>}
                          {account.location && <span>📍 {account.location}</span>}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {account.currency && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-semibold">
                          {account.currency}
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

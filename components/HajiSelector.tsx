
import React, { useState, useEffect, useRef } from 'react';
import { HajiMaster } from '../types';
import { HajiService } from '../services/HajiService';

interface HajiSelectorProps {
  value: string;
  passportValue?: string;
  onSelect: (haji: Partial<HajiMaster>) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

const HajiSelector: React.FC<HajiSelectorProps> = ({ 
  value, 
  passportValue, 
  onSelect, 
  placeholder = "Search Haji...", 
  className = "",
  label
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<HajiMaster[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      setShowDropdown(false);
      // Still notify parent of manual change if parent doesn't use the dropdown
      onSelect({ fullName: q });
      return;
    }

    setIsSearching(true);
    try {
      const matches = await HajiService.search(q);
      setResults(matches);
      setShowDropdown(matches.length > 0);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (haji: HajiMaster) => {
    setQuery(haji.fullName);
    onSelect(haji);
    setShowDropdown(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">{label}</label>}
      <div className="relative">
        <input 
          type="text"
          className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none transition-all focus:ring-2 focus:ring-blue-500"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length >= 2 && setShowDropdown(results.length > 0)}
        />
        {isSearching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-[120] mt-2 w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-60 overflow-y-auto no-scrollbar">
            {results.map((haji) => (
              <button
                key={haji.id}
                type="button"
                className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b last:border-0 border-slate-50 dark:border-slate-800 flex items-center justify-between group"
                onClick={() => handleSelect(haji)}
              >
                <div>
                  <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                    {haji.fullName}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                    ID: {haji.hajiId} • {haji.nationality || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-orbitron font-black text-blue-600 dark:text-blue-400">
                    {haji.passportNumber}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/30 text-center">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
              Showing {results.length} results from master database
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HajiSelector;

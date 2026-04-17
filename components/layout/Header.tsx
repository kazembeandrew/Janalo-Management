import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Search, Calculator } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from '@/components/NotificationBell';
import { SearchBar } from '@/components/ui/SearchBar';
import { PAGE_TITLES } from '@/config/navigation';

interface HeaderProps {
  onMenuOpen: () => void;
  onSearchOpen: () => void;
  globalSearchQuery: string;
  onGlobalSearchQueryChange: (query: string) => void;
  onGlobalSearchFocusChange: (focused: boolean) => void;
  onGlobalSearch: (query: string, opts?: { force?: boolean }) => Promise<{ borrowers: any; loans: any[] }>;
  onGlobalSearchSubmit: (query: string) => Promise<{ borrowers: any; loans: any[] }>;
  showGlobalDropdown: boolean;
  globalSearchLoading: boolean;
  globalSearchError: string | null;
  globalSearchResults: { borrowers: any[]; loans: any[] };
  onCloseGlobalSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onMenuOpen,
  onSearchOpen,
  globalSearchQuery,
  onGlobalSearchQueryChange,
  onGlobalSearchFocusChange,
  onGlobalSearch,
  onGlobalSearchSubmit,
  showGlobalDropdown,
  globalSearchLoading,
  globalSearchError,
  globalSearchResults,
  onCloseGlobalSearch,
}) => {
  const { profile } = useAuth();
  const location = window.location;
  const navigate = useNavigate();

  // Memoized header icon button class
  const headerIconButtonClass = useMemo(
    () =>
      'flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 transition-all duration-200 active:scale-95',
    []
  );

  const getPageTitle = () => {
    const path = location.pathname;
    return PAGE_TITLES[path] || 'JANALO';
  };

  const getLoanBorrowerName = (loan: any) => {
    const b = loan?.borrowers;
    if (!b) return '';
    if (Array.isArray(b)) return b[0]?.full_name || '';
    return b.full_name || '';
  };

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 h-16 bg-white/95 backdrop-blur-xl transition-all duration-200"
      style={{
        borderBottom: '1px solid rgba(226,232,240,0.9)',
        boxShadow: '0 1px 0 0 rgba(226,232,240,0.8), 0 4px 16px -4px rgba(15,23,42,0.06)',
      }}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <button
          onClick={onMenuOpen}
          className="md:hidden p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all active:scale-95"
          aria-label="Open menu"
          title="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <button
          onClick={onSearchOpen}
          className="sm:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all active:scale-95"
          aria-label="Search"
          title="Search"
        >
          <Search className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-base md:text-lg font-extrabold text-gray-900 whitespace-nowrap font-display tracking-tight leading-none">
            {getPageTitle()}
          </h1>
        </div>

        <div className="hidden sm:block h-6 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent" />

        <div className="hidden sm:block w-full max-w-2xl min-w-0">
          <div className="relative">
            <SearchBar
              placeholder="Search clients, loans, or references..."
              value={globalSearchQuery}
              onChange={onGlobalSearchQueryChange}
              onFocusChange={onGlobalSearchFocusChange}
              minChars={2}
              searchEmpty={true}
              onSearch={(q) => void onGlobalSearch(q)}
              onSubmit={async (q) => {
                await onGlobalSearchSubmit(q);
              }}
              showFilterButton={true}
              showHistory={true}
            />

            {showGlobalDropdown && (
              <div
                className="absolute top-full left-0 right-0 mt-2.5 bg-white rounded-2xl shadow-2xl border border-gray-200/80 overflow-hidden z-50 animate-slide-down"
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="p-3 max-h-[28rem] overflow-y-auto">
                  <div className="flex items-center justify-between px-3 py-2.5 mb-2 bg-gray-50/50 rounded-lg">
                    <div className="flex items-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <Search className="h-3.5 w-3.5 mr-2" />
                      Search Results
                    </div>
                    {globalSearchLoading && (
                      <div className="text-xs text-gray-500 flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        Searching…
                      </div>
                    )}
                  </div>

                  {!!globalSearchError && (
                    <div className="px-3 py-3 text-sm text-red-600 bg-red-50 rounded-lg mb-2">
                      {globalSearchError}
                    </div>
                  )}

                  {!globalSearchLoading &&
                    !globalSearchError &&
                    globalSearchResults.borrowers.length === 0 &&
                    globalSearchResults.loans.length === 0 && (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        No results found for "{globalSearchQuery}"
                      </div>
                    )}

                  {globalSearchResults.borrowers.length > 0 && (
                    <>
                      <div className="px-3 pt-3 pb-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-2">
                        Borrowers ({globalSearchResults.borrowers.length})
                      </div>
                      {globalSearchResults.borrowers.map((b) => (
                        <button
                          key={b.id}
                          className="w-full flex items-center px-3 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 rounded-xl transition-all duration-200 group mb-1"
                          onClick={() => {
                            onCloseGlobalSearch();
                            navigate(`/borrowers/${b.id}`);
                          }}
                          type="button"
                        >
                          <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center mr-3 group-hover:bg-indigo-200 transition-colors">
                            <span className="text-indigo-600 group-hover:text-indigo-700 text-xs font-bold">
                              B
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="font-semibold truncate">{b.full_name}</div>
                            <div className="text-xs text-gray-500 truncate">View borrower details</div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {globalSearchResults.loans.length > 0 && (
                    <>
                      <div className="px-3 pt-3 pb-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-2 mt-3">
                        Loans ({globalSearchResults.loans.length})
                      </div>
                      {globalSearchResults.loans.map((l) => (
                        <button
                          key={l.id}
                          className="w-full flex items-center px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 rounded-xl transition-all duration-200 group mb-1"
                          onClick={() => {
                            onCloseGlobalSearch();
                            navigate(`/loans/${l.id}`);
                          }}
                          type="button"
                        >
                          <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center mr-3 group-hover:bg-emerald-200 transition-colors">
                            <span className="text-emerald-600 group-hover:text-emerald-700 text-xs font-bold">
                              L
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="font-semibold truncate">{l.reference_no}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {getLoanBorrowerName(l)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2">
        <Link
          to="/calculator"
          className={headerIconButtonClass}
          title="Loan Calculator"
          aria-label="Open calculator"
        >
          <Calculator className="h-5 w-5" />
        </Link>
        <NotificationBell />
        <div className="hidden sm:flex items-center gap-2 pl-2 ml-1" style={{ borderLeft: '1px solid #e2e8f0' }}>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm cursor-default">
            {profile?.full_name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="hidden md:block">
            <div className="text-xs font-bold text-gray-800 leading-none">
              {profile?.full_name?.split(' ')[0]}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5 capitalize">
              {profile?.role?.replace('_', ' ')}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

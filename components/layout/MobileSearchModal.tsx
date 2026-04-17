import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';

interface MobileSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const MobileSearchModal: React.FC<MobileSearchModalProps> = ({
  isOpen,
  onClose,
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
  const navigate = useNavigate();

  const getLoanBorrowerName = (loan: any) => {
    const b = loan?.borrowers;
    if (!b) return '';
    if (Array.isArray(b)) return b[0]?.full_name || '';
    return b.full_name || '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 sm:hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 top-12 mx-4">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-down">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Search</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close search"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative">
              <SearchBar
                placeholder="Search clients or loan references..."
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
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 max-h-96 overflow-y-auto"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="p-2">
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center text-xs font-medium text-gray-600">
                        <Search className="h-3.5 w-3.5 mr-1.5" />
                        Results
                      </div>
                      {globalSearchLoading && (
                        <div className="text-xs text-gray-500 flex items-center">
                          <span className="inline-block h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-1" />
                          Searching…
                        </div>
                      )}
                    </div>

                    {!!globalSearchError && (
                      <div className="px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg mx-2">
                        {globalSearchError}
                      </div>
                    )}

                    {!globalSearchLoading &&
                      !globalSearchError &&
                      globalSearchResults.borrowers.length === 0 &&
                      globalSearchResults.loans.length === 0 && (
                        <div className="px-3 py-3 text-sm text-gray-500 text-center">
                          No results found
                        </div>
                      )}

                    {globalSearchResults.borrowers.length > 0 && (
                      <>
                        <div className="px-3 pt-3 pb-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                          Borrowers
                        </div>
                        {globalSearchResults.borrowers.map((b) => (
                          <button
                            key={b.id}
                            className="w-full flex items-center px-3 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 rounded-lg transition-all duration-200 group"
                            onClick={() => {
                              onClose();
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
                            <span className="truncate font-medium">{b.full_name}</span>
                          </button>
                        ))}
                      </>
                    )}

                    {globalSearchResults.loans.length > 0 && (
                      <>
                        <div className="px-3 pt-3 pb-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                          Loans
                        </div>
                        {globalSearchResults.loans.map((l) => (
                          <button
                            key={l.id}
                            className="w-full flex items-center px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 rounded-lg transition-all duration-200 group"
                            onClick={() => {
                              onClose();
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
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-semibold">{l.reference_no}</div>
                              <div className="truncate text-xs text-gray-500">
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
      </div>
    </div>
  );
};

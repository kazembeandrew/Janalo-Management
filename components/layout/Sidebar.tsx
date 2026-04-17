import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PieChart, X, ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  SECTION_GROUPS,
  getItemsBySection,
  filterNavigationByRoles,
  type NavigationItem,
} from '@/config/navigation';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  navigation: NavigationItem[];
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  navigation,
  onSignOut,
}) => {
  const { profile, effectiveRoles } = useAuth();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Core Operations': true,
    'Financial Management': false,
    'Reporting & Analytics': false,
    'Administration': false,
  });

  const toggleSection = useCallback((sectionName: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  }, []);

  const filteredNavigation = filterNavigationByRoles(navigation, effectiveRoles);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[17rem] bg-gradient-to-b from-[#0f0e27] via-[#13124a] to-[#0d1929] text-white transform transition-transform duration-300 ease-out md:translate-x-0 md:static md:inset-0 shadow-2xl flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ borderRight: '1px solid rgba(99,102,241,0.18)' }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo Section */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(99,102,241,0.15)' }}
        >
          <Link to="/" className="flex items-center gap-3 group">
            <div
              className="relative h-9 w-9 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)' }}
            >
              <PieChart className="h-5 w-5 text-indigo-300 group-hover:text-indigo-200 transition-colors" />
            </div>
            <span className="text-[1.35rem] font-extrabold tracking-[0.12em] font-display bg-gradient-to-r from-indigo-200 via-white to-indigo-300 bg-clip-text text-transparent">
              JANALO
            </span>
          </Link>
          <button
            className="md:hidden p-1.5 text-indigo-400 hover:text-white hover:bg-indigo-800/50 rounded-lg transition-all"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Profile Section */}
        <div className="px-4 py-3.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
          <div
            className="flex items-center gap-3 p-2.5 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.1)' }}
          >
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
              {profile?.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate leading-tight">
                {profile?.full_name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: 'rgba(99,102,241,0.3)', color: '#a5b4fc' }}
                >
                  {profile?.role?.replace('_', ' ')}
                </span>
                {profile?.delegated_role && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: 'rgba(59,130,246,0.25)', color: '#93c5fd' }}
                  >
                    +{profile.delegated_role.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto sidebar-scroll">
          {SECTION_GROUPS.map((section) => {
            const sectionItems = getItemsBySection(section.title, filteredNavigation);
            if (sectionItems.length === 0) return null;

            const isExpanded = expandedSections[section.title];
            const SectionIcon = section.icon;

            return (
              <div key={section.title} className="mb-1">
                <button
                  onClick={() => toggleSection(section.title)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group ${
                    isExpanded ? 'text-white' : 'text-indigo-300/60 hover:text-indigo-200'
                  }`}
                  aria-expanded={isExpanded}
                  aria-controls={`section-${section.title}`}
                  aria-label={`Toggle ${section.title} section`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded-md ${section.color}`}>
                      <SectionIcon className="h-3 w-3" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.1em]">
                      {section.title}
                    </span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(165,180,252,0.7)' }}
                    >
                      {sectionItems.length}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      isExpanded ? 'rotate-0' : '-rotate-90'
                    } opacity-50`}
                  />
                </button>

                {isExpanded && (
                  <div
                    id={`section-${section.title}`}
                    className="mt-1 ml-2 pl-3 space-y-0.5 animate-slide-down"
                    style={{ borderLeft: '1px solid rgba(99,102,241,0.18)' }}
                    role="group"
                  >
                    {sectionItems.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 relative ${
                            isActive
                              ? 'nav-item-active text-white'
                              : 'text-indigo-300/70 hover:bg-white/6 hover:text-indigo-100'
                          }`}
                          onClick={() => onClose()}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <item.icon
                            className={`h-4 w-4 shrink-0 ${
                              isActive
                                ? 'text-indigo-300'
                                : 'text-indigo-400/60 group-hover:text-indigo-300'
                            }`}
                          />
                          <span className="text-[13px] font-medium flex-1">{item.name}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sign Out Section */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(99,102,241,0.15)' }}>
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-indigo-400/80 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

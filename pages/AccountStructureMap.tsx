import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { InternalAccount, JournalLine } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { accountsService } from '@/services/accounts';
import { journalEntriesService } from '@/services/journalEntries';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Shield,
  ChevronRight,
  ChevronDown,
  Download,
  RefreshCw,
  Layers,
  GitBranch,
  Activity,
  PieChart,
  ArrowRight,
  FileText,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  Eye,
  Printer,
  FileSpreadsheet,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
  CircleDollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TreemapNode {
  name: string;
  value: number;
  color: string;
  category: string;
  children?: TreemapNode[];
  account_id?: string;
  balance_formatted?: string;
  depth: number;
}

interface AccountNode extends InternalAccount {
  children?: AccountNode[];
  depth?: number;
  balance_formatted?: string;
  health_status?: 'healthy' | 'warning' | 'inactive';
  last_transaction_date?: string;
  transaction_count_30d?: number;
  balance_trend?: 'up' | 'down' | 'stable';
}

interface CategoryConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  description: string;
}

const categoryConfig: Record<string, CategoryConfig> = {
  asset: {
    icon: Wallet,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    description: 'Resources owned by the institution (Cash, Receivables, Property)',
  },
  liability: {
    icon: TrendingDown,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    description: 'Obligations and debts owed to others',
  },
  equity: {
    icon: Shield,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    description: 'Owner\'s interest in the institution (Capital + Retained Earnings)',
  },
  income: {
    icon: TrendingUp,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    description: 'Revenue earned from operations (Interest, Fees)',
  },
  expense: {
    icon: Activity,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    description: 'Costs incurred in operations (Salaries, Rent, Utilities)',
  },
};

export const AccountStructureMap: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [accounts, setAccounts] = useState<AccountNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'hierarchy' | 'flowchart' | 'treemap'>('hierarchy');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<AccountNode | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<JournalLine[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [historicalDate, setHistoricalDate] = useState<string>('');
  const [showHistoricalView, setShowHistoricalView] = useState(false);
  const [historicalAccounts, setHistoricalAccounts] = useState<AccountNode[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredTreemapNode, setHoveredTreemapNode] = useState<TreemapNode | null>(null);
  const [treemapData, setTreemapData] = useState<TreemapNode[]>([]);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; account_code: string }>({ name: '', account_code: '' });
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');

  // Fetch accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  // Real-time balance updates
  useEffect(() => {
    const channel = supabase
      .channel('account-balances-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'internal_accounts' },
        (payload) => {
          const updatedAccount = payload.new as InternalAccount;
          setAccounts(prev => updateAccountBalance(prev, updatedAccount));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateAccountBalance = (nodes: AccountNode[], updated: InternalAccount): AccountNode[] => {
    return nodes.map(node => {
      if (node.id === updated.id) {
        return {
          ...node,
          ...updated,
          balance_formatted: formatCurrency(Number(updated.balance) || 0),
        };
      }
      if (node.children?.length) {
        return {
          ...node,
          children: updateAccountBalance(node.children, updated),
        };
      }
      return node;
    });
  };

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await accountsService.getAccounts();
      
      if (result.error) {
        throw new Error(result.error.message || 'Failed to fetch accounts');
      }
      
      if (!result.data) {
        setAccounts([]);
        toast.error('No accounts found. Please check your database connection.');
        return;
      }
      
      if (result.data.data.length === 0) {
        setAccounts([]);
        toast.success('No accounts configured. System accounts will be created automatically.');
        return;
      }
      
      const accountTree = await buildAccountTreeWithHealth(result.data.data);
      setAccounts(accountTree);
      
      // Auto-expand root nodes
      const rootIds = new Set(accountTree.map(acc => acc.id));
      setExpandedNodes(rootIds);
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred');
      toast.error('Failed to load accounts: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const buildAccountTreeWithHealth = async (flatAccounts: InternalAccount[]): Promise<AccountNode[]> => {
    const accountMap = new Map<string, AccountNode>();
    const rootAccounts: AccountNode[] = [];

    // Calculate health metrics for each account
    const healthMetrics = await calculateHealthMetrics(flatAccounts.map(a => a.id));

    // Create nodes with health data
    flatAccounts.forEach(account => {
      const health = healthMetrics.get(account.id);
      accountMap.set(account.id, {
        ...account,
        children: [],
        depth: 0,
        balance_formatted: formatCurrency(Number(account.balance) || 0),
        health_status: health?.status || 'healthy',
        last_transaction_date: health?.lastTransactionDate,
        transaction_count_30d: health?.transactionCount30d || 0,
        balance_trend: health?.trend || 'stable',
      });
    });

    // Build tree
    flatAccounts.forEach(account => {
      const node = accountMap.get(account.id)!;
      
      if (account.parent_id && accountMap.has(account.parent_id)) {
        const parent = accountMap.get(account.parent_id)!;
        parent.children = parent.children || [];
        parent.children.push(node);
        node.depth = (parent.depth || 0) + 1;
      } else {
        rootAccounts.push(node);
      }
    });

    return rootAccounts.sort((a, b) => {
      const categoryOrder = ['asset', 'liability', 'equity', 'income', 'expense'];
      return categoryOrder.indexOf(a.account_category) - categoryOrder.indexOf(b.account_category);
    });
  };

  const calculateHealthMetrics = async (accountIds: string[]) => {
    const metrics = new Map<string, {
      status: 'healthy' | 'warning' | 'inactive';
      lastTransactionDate?: string;
      transactionCount30d: number;
      trend: 'up' | 'down' | 'stable';
    }>();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Fetch recent transactions for all accounts in parallel
    const promises = accountIds.map(async (accountId) => {
      try {
        const result = await journalEntriesService.getJournalEntriesByAccount(
          accountId,
          thirtyDaysAgoStr
        );
        
        const transactions = result.data || [];
        const count30d = transactions.length;
        // Note: JournalLine doesn't have entry_date, would need to join with journal_entries
        // const lastTransaction = transactions[0]?.entry_date;
        const lastTransaction = undefined;

        // Determine health status
        let status: 'healthy' | 'warning' | 'inactive' = 'healthy';
        if (count30d === 0) {
          status = 'inactive';
        } else if (count30d < 3) {
          status = 'warning';
        }

        // Simple trend calculation (would need historical data for accuracy)
        const trend: 'up' | 'down' | 'stable' = 'stable';

        metrics.set(accountId, {
          status,
          lastTransactionDate: lastTransaction,
          transactionCount30d: count30d,
          trend,
        });
      } catch (err) {
        console.error(`Error calculating metrics for account ${accountId}:`, err);
        metrics.set(accountId, {
          status: 'healthy',
          transactionCount30d: 0,
          trend: 'stable',
        });
      }
    });

    await Promise.all(promises);
    return metrics;
  };

  const toggleNode = (accountId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: AccountNode[]) => {
      nodes.forEach(node => {
        allIds.add(node.id);
        if (node.children?.length) {
          collectIds(node.children);
        }
      });
    };
    collectIds(accounts);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const filteredAccounts = useMemo(() => {
    let result = accounts;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      const filterByCategory = (nodes: AccountNode[]): AccountNode[] => {
        return nodes.filter(node => node.account_category === selectedCategory).map(node => ({
          ...node,
          children: node.children ? filterByCategory(node.children) : [],
        }));
      };
      result = filterByCategory(result);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filterBySearch = (nodes: AccountNode[]): AccountNode[] => {
        return nodes.reduce<AccountNode[]>((filtered, node) => {
          const matchesName = node.name.toLowerCase().includes(query);
          const matchesCode = node.account_code?.toLowerCase().includes(query);
          const matchesCategory = node.account_category.toLowerCase().includes(query);
          
          const children = node.children ? filterBySearch(node.children) : [];
          
          if (matchesName || matchesCode || matchesCategory || children.length > 0) {
            filtered.push({ ...node, children });
          }
          
          return filtered;
        }, []);
      };
      result = filterBySearch(result);
    }

    return result;
  }, [accounts, selectedCategory, searchQuery]);

  const totals = useMemo(() => {
    const calculateTotals = (nodes: AccountNode[]) => {
      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;
      let totalIncome = 0;
      let totalExpenses = 0;

      const traverse = (nodeList: AccountNode[]) => {
        nodeList.forEach(node => {
          const balance = Number(node.balance) || 0;
          
          switch (node.account_category) {
            case 'asset':
              totalAssets += balance;
              break;
            case 'liability':
              totalLiabilities += balance;
              break;
            case 'equity':
              totalEquity += balance;
              break;
            case 'income':
              totalIncome += balance;
              break;
            case 'expense':
              totalExpenses += balance;
              break;
          }

          if (node.children?.length) {
            traverse(node.children);
          }
        });
      };

      traverse(nodes);

      return {
        assets: totalAssets,
        liabilities: totalLiabilities,
        equity: totalEquity,
        income: totalIncome,
        expenses: totalExpenses,
        netWorth: totalAssets - totalLiabilities,
        netProfit: totalIncome - totalExpenses,
      };
    };

    return calculateTotals(accounts);
  }, [accounts]);

  // Treemap visualization data
  const treemapVisualization = useMemo(() => {
    const categoryColors: Record<string, string> = {
      asset: '#10b981',
      liability: '#f43f5e',
      equity: '#3b82f6',
      income: '#22c55e',
      expense: '#f97316',
    };

    const buildTreemap = (nodes: AccountNode[], depth: number = 0): TreemapNode[] => {
      return nodes.map(node => {
        const value = Math.abs(Number(node.balance) || 0);
        const treemapNode: TreemapNode = {
          name: node.name,
          value,
          color: categoryColors[node.account_category] || '#6b7280',
          category: node.account_category,
          account_id: node.id,
          balance_formatted: node.balance_formatted,
          depth,
        };

        if (node.children && node.children.length > 0) {
          treemapNode.children = buildTreemap(node.children, depth + 1);
        }

        return treemapNode;
      });
    };

    return buildTreemap(accounts);
  }, [accounts]);

  // Calculate treemap layout
  const calculateTreemapLayout = (nodes: TreemapNode[], width: number, height: number) => {
    const totalValue = nodes.reduce((sum, node) => sum + node.value, 0);
    if (totalValue === 0) return [];

    const layouts: Array<TreemapNode & { x: number; y: number; w: number; h: number }> = [];
    
    const layout = (
      items: TreemapNode[],
      x: number,
      y: number,
      w: number,
      h: number
    ) => {
      if (items.length === 0) return;
      
      if (items.length === 1) {
        const item = items[0];
        layouts.push({ ...item, x, y, w, h });
        
        if (item.children && item.children.length > 0) {
          layout(item.children, x + 2, y + 2, w - 4, h - 4);
        }
        return;
      }

      const aspectRatio = w / h;
      let currentX = x;
      let currentY = y;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const proportion = item.value / totalValue;
        
        let itemW: number, itemH: number;
        
        if (aspectRatio >= 1) {
          itemW = w * proportion;
          itemH = h;
        } else {
          itemW = w;
          itemH = h * proportion;
        }

        layouts.push({
          ...item,
          x: currentX,
          y: currentY,
          w: itemW,
          h: itemH,
        });

        if (item.children && item.children.length > 0) {
          layout(item.children, currentX + 2, currentY + 2, itemW - 4, itemH - 4);
        }

        if (aspectRatio >= 1) {
          currentX += itemW;
        } else {
          currentY += itemH;
        }
      }
    };

    layout(nodes, 0, 0, width, height);
    return layouts;
  };

  const handleTreemapNodeClick = (node: TreemapNode) => {
    if (node.account_id) {
      const account = accounts.find(a => a.id === node.account_id);
      if (account) {
        handleViewTransactions(account);
      }
    }
  };

  const renderTreemap = () => {
    const containerWidth = 1200;
    const containerHeight = 600;
    const layouts = calculateTreemapLayout(treemapVisualization, containerWidth, containerHeight);

    return (
      <div className="relative w-full" style={{ height: containerHeight }}>
        <svg
          viewBox={`0 0 ${containerWidth} ${containerHeight}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {layouts.map((layout, index) => {
            const fontSize = Math.max(10, Math.min(16, layout.w / 10));
            const showText = layout.w > 60 && layout.h > 40;
            
            return (
              <g key={`${layout.name}-${index}`}>
                <rect
                  x={layout.x}
                  y={layout.y}
                  width={layout.w}
                  height={layout.h}
                  fill={layout.color}
                  stroke="white"
                  strokeWidth="2"
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onClick={() => handleTreemapNodeClick(layout)}
                  onMouseEnter={() => setHoveredTreemapNode(layout)}
                  onMouseLeave={() => setHoveredTreemapNode(null)}
                  rx="4"
                />
                {showText && (
                  <text
                    x={layout.x + layout.w / 2}
                    y={layout.y + layout.h / 2 - 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={fontSize}
                    fontWeight="bold"
                    className="pointer-events-none select-none"
                  >
                    {layout.name.length > 20 ? layout.name.substring(0, 18) + '...' : layout.name}
                  </text>
                )}
                {showText && (
                  <text
                    x={layout.x + layout.w / 2}
                    y={layout.y + layout.h / 2 + 12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={fontSize - 2}
                    className="pointer-events-none select-none"
                  >
                    {layout.balance_formatted}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredTreemapNode && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-200 z-10 min-w-[200px]">
            <div className="text-sm font-bold text-gray-900 mb-1">{hoveredTreemapNode.name}</div>
            <div className="text-xs text-gray-500 capitalize mb-2">{hoveredTreemapNode.category}</div>
            <div className="text-lg font-bold tabular-nums" style={{ color: hoveredTreemapNode.color }}>
              {hoveredTreemapNode.balance_formatted}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">Click to view transactions</div>
          </div>
        )}
      </div>
    );
  };

  const handleExportMap = (format: 'json' | 'csv' = 'json') => {
    if (format === 'csv') {
      exportAsCSV();
    } else {
      exportAsJSON();
    }
  };

  const exportAsJSON = () => {
    const exportData = {
      exported_at: new Date().toISOString(),
      summary: {
        total_accounts: accounts.length,
        categories: {
          assets: totals.assets,
          liabilities: totals.liabilities,
          equity: totals.equity,
          income: totals.income,
          expenses: totals.expenses,
        },
        financial_position: {
          net_worth: totals.netWorth,
          net_profit: totals.netProfit,
        },
      },
      chart_of_accounts: accounts,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    downloadFile(blob, `account_structure_map_${new Date().toISOString().split('T')[0]}.json`);
    toast.success('Account structure map exported as JSON');
  };

  const exportAsCSV = () => {
    const csvRows: string[] = [];
    csvRows.push(['Account Name', 'Account Code', 'Category', 'Type', 'Balance', 'Parent Account', 'Is System Account'].join(','));
    
    const flattenAccounts = (nodes: AccountNode[], parentName = '') => {
      nodes.forEach(node => {
        const row = [
          `"${node.name.replace(/"/g, '""')}"`,
          node.account_code || '',
          node.account_category,
          node.type || '',
          Number(node.balance) || 0,
          parentName,
          node.is_system_account ? 'Yes' : 'No',
        ];
        csvRows.push(row.join(','));
        
        if (node.children?.length) {
          flattenAccounts(node.children, node.name);
        }
      });
    };
    
    flattenAccounts(accounts);
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `account_structure_map_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Account structure map exported as CSV');
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleViewHistorical = async () => {
    if (!historicalDate) {
      toast.error('Please select a date');
      return;
    }

    setLoading(true);
    setShowHistoricalView(true);
    try {
      // Fetch accounts with balances as of historical date
      const result = await accountsService.getBalanceSheet(historicalDate);
      if (result.data) {
        // Get all accounts and update their balances
        const accountsResult = await accountsService.getAccounts();
        if (accountsResult.data) {
          // Update balances based on historical data
          const historicalTree = await buildAccountTreeWithHealth(accountsResult.data.data);
          setHistoricalAccounts(historicalTree);
          toast.success(`Showing account structure as of ${new Date(historicalDate).toLocaleDateString()}`);
        }
      }
    } catch (err: any) {
      console.error('Error fetching historical data:', err);
      toast.error('Failed to load historical data');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistorical = () => {
    setShowHistoricalView(false);
    setHistoricalDate('');
    setHistoricalAccounts([]);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K or / to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      
      // Escape to close modals or clear search
      if (e.key === 'Escape') {
        if (showTransactionModal) {
          setShowTransactionModal(false);
        } else if (searchQuery) {
          setSearchQuery('');
        }
      }

      // Arrow keys for navigation in hierarchy view
      if (viewMode === 'hierarchy' && !showTransactionModal && !searchQuery) {
        const visibleNodes = getAllVisibleNodes(showHistoricalView ? historicalAccounts : accounts);
        const currentIndex = visibleNodes.findIndex(node => {
          const element = document.querySelector(`[data-account-id="${node.id}"]`);
          return element === document.activeElement;
        });

        if (e.key === 'ArrowDown' && currentIndex < visibleNodes.length - 1) {
          e.preventDefault();
          focusNode(visibleNodes[currentIndex + 1].id);
        } else if (e.key === 'ArrowUp' && currentIndex > 0) {
          e.preventDefault();
          focusNode(visibleNodes[currentIndex - 1].id);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (currentIndex >= 0) {
            toggleNode(visibleNodes[currentIndex].id);
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (currentIndex >= 0) {
            const node = visibleNodes[currentIndex];
            if (expandedNodes.has(node.id)) {
              toggleNode(node.id);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [accounts, historicalAccounts, showHistoricalView, viewMode, searchQuery, showTransactionModal, expandedNodes]);

  const getAllVisibleNodes = (nodes: AccountNode[]): AccountNode[] => {
    const visible: AccountNode[] = [];
    const traverse = (nodeList: AccountNode[]) => {
      nodeList.forEach(node => {
        visible.push(node);
        if (node.children?.length && expandedNodes.has(node.id)) {
          traverse(node.children);
        }
      });
    };
    traverse(nodes);
    return visible;
  };

  const focusNode = (accountId: string) => {
    const element = document.querySelector(`[data-account-id="${accountId}"]`);
    if (element) {
      (element as HTMLElement).focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleViewTransactions = async (account: AccountNode) => {
    setSelectedAccount(account);
    setShowTransactionModal(true);
    setLoadingTransactions(true);
    
    try {
      const result = await journalEntriesService.getJournalEntriesByAccount(account.id);
      setRecentTransactions(result.data || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      toast.error('Failed to load transactions');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleStartEdit = (account: AccountNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAccount(account.id);
    setEditForm({ name: account.name, account_code: account.account_code || '' });
  };

  const handleCancelEdit = () => {
    setEditingAccount(null);
    setEditForm({ name: '', account_code: '' });
  };

  const handleSaveEdit = async (accountId: string) => {
    if (!editForm.name.trim()) {
      toast.error('Account name is required');
      return;
    }

    setIsSaving(true);
    try {
      const result = await accountsService.updateAccount({
        id: accountId,
        name: editForm.name.trim(),
        account_code: editForm.account_code.trim() || undefined,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast.success('Account updated successfully');
      setEditingAccount(null);
      await fetchAccounts();
    } catch (err: any) {
      console.error('Error updating account:', err);
      toast.error('Failed to update account: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getHealthIcon = (status?: string) => {
    switch (status) {
      case 'inactive':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }
  };

  const getHealthTooltip = (account: AccountNode) => {
    if (account.health_status === 'inactive') {
      return 'No transactions in last 30 days';
    }
    if (account.health_status === 'warning') {
      return `Low activity: ${account.transaction_count_30d} transactions in last 30 days`;
    }
    return 'Active account';
  };

  const renderAccountNode = (node: AccountNode, level: number = 0, isHistorical: boolean = false) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const config = categoryConfig[node.account_category] || categoryConfig.asset; // Fallback to asset config
    const IconComponent = config.icon;

    // Highlight matching search results
    const isHighlighted = searchQuery && (
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.account_code?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get historical balance if in historical view
    const displayBalance = node.balance_formatted;
    const balanceTrendIcon = node.balance_trend === 'up' ? 
      <ArrowUpCircle className="h-3 w-3 text-emerald-500" /> :
      node.balance_trend === 'down' ?
      <ArrowDownCircle className="h-3 w-3 text-rose-500" /> :
      node.balance_trend === 'stable' ?
      <MinusCircle className="h-3 w-3 text-gray-400" /> : null;

    return (
      <div key={node.id} className="select-none" data-account-id={node.id} tabIndex={0}>
        <div
          className={`flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-gray-50 group focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            level === 0 ? 'border-l-4 border-indigo-500 bg-indigo-50/30' : ''
          } ${isHighlighted ? 'ring-2 ring-indigo-400 bg-indigo-50' : ''}`}
          style={{ marginLeft: `${level * 24}px` }}
        >
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <button
              onClick={() => toggleNode(node.id)}
              className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          {/* Category Icon */}
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <IconComponent className={`h-5 w-5 ${config.color}`} />
          </div>

          {/* Account Info */}
          <div className="flex-1 min-w-0">
            {editingAccount === node.id && isAdmin ? (
              <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Account name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveEdit(node.id);
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                />
                <input
                  type="text"
                  value={editForm.account_code}
                  onChange={(e) => setEditForm({ ...editForm, account_code: e.target.value })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                  placeholder="Account code"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveEdit(node.id);
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(node.id)}
                    disabled={isSaving}
                    className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 truncate">{node.name}</span>
                  {node.is_system_account && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full uppercase">
                      System
                    </span>
                  )}
                  {node.account_code && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-mono rounded">
                      {node.account_code}
                    </span>
                  )}
                  {/* Health indicator */}
                  <div 
                    className="opacity-0 group-hover:opacity-100 transition-opacity cursor-help"
                    title={getHealthTooltip(node)}
                  >
                    {getHealthIcon(node.health_status)}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 capitalize flex items-center gap-2">
                  <span>{node.account_category}</span>
                  {node.type && node.type !== node.account_category && (
                    <>
                      <span>•</span>
                      <span>{node.type}</span>
                    </>
                  )}
                  {node.transaction_count_30d !== undefined && (
                    <span className="text-gray-400">
                      ({node.transaction_count_30d} txns this month)
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Balance and Actions */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-bold text-gray-900 tabular-nums">
                {node.balance_formatted}
              </div>
              {hasChildren && (
                <div className="text-[10px] text-gray-400">
                  {node.children?.length} sub-account{node.children?.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            
            {/* Quick actions */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
              {isAdmin && editingAccount !== node.id && (
                <button
                  onClick={(e) => handleStartEdit(node, e)}
                  className="p-2 hover:bg-indigo-50 rounded-lg transition-all"
                  title="Edit account"
                >
                  <FileText className="h-4 w-4 text-indigo-600" />
                </button>
              )}
              <button
                onClick={() => handleViewTransactions(node)}
                className="p-2 hover:bg-indigo-50 rounded-lg transition-all"
                title="View transactions"
              >
                <Eye className="h-4 w-4 text-indigo-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="mt-1 space-y-1">
            {node.children!.map(child => renderAccountNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderFlowchartView = () => {
    const categories = ['asset', 'liability', 'equity', 'income', 'expense'];

    return (
      <div className="space-y-8">
        {categories.map(category => {
          const categoryAccounts = accounts.filter(acc => acc.account_category === category);
          if (categoryAccounts.length === 0) return null;

          const config = categoryConfig[category];
          const IconComponent = config.icon;

          return (
            <div key={category} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Category Header */}
              <div className={`${config.bgColor} px-6 py-4 border-b border-gray-100`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-white`}>
                    <IconComponent className={`h-6 w-6 ${config.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 capitalize text-lg">{category}s</h3>
                    <p className="text-xs text-gray-600">{config.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums">
                      {formatCurrency(
                        category === 'asset' ? totals.assets :
                        category === 'liability' ? totals.liabilities :
                        category === 'equity' ? totals.equity :
                        category === 'income' ? totals.income :
                        totals.expenses
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Accounts Grid */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryAccounts.map(account => (
                    <div
                      key={account.id}
                      className="p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all group cursor-pointer"
                      onClick={() => handleViewTransactions(account)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-900 truncate">{account.name}</div>
                          {account.account_code && (
                            <div className="text-xs text-gray-500 font-mono mt-0.5">
                              {account.account_code}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {account.is_system_account && (
                            <Shield className="h-4 w-4 text-purple-500" />
                          )}
                          <div title={getHealthTooltip(account)}>
                            {getHealthIcon(account.health_status)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="text-sm text-gray-600 mb-1">Balance</div>
                        <div className="text-xl font-bold tabular-nums text-gray-900">
                          {formatCurrency(Number(account.balance) || 0)}
                        </div>
                      </div>

                      {account.parent_id && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                            <ArrowRight className="h-3 w-3" />
                            Child account
                          </div>
                        </div>
                      )}

                      <div className="mt-2 pt-2 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span>{account.transaction_count_30d || 0} transactions</span>
                          <Eye className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTransactionModal = () => {
    if (!showTransactionModal || !selectedAccount) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedAccount.name}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedAccount.account_code} • {selectedAccount.account_category}
              </p>
            </div>
            <button
              onClick={() => setShowTransactionModal(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
            {/* Account Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-xl">
                <div className="text-xs text-gray-500 mb-1">Current Balance</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(Number(selectedAccount.balance) || 0)}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <div className="text-xs text-gray-500 mb-1">Transactions (30d)</div>
                <div className="text-2xl font-bold text-gray-900">
                  {selectedAccount.transaction_count_30d || 0}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <div className="text-xs text-gray-500 mb-1">Last Transaction</div>
                <div className="text-sm font-bold text-gray-900">
                  {selectedAccount.last_transaction_date 
                    ? new Date(selectedAccount.last_transaction_date).toLocaleDateString()
                    : 'N/A'}
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Recent Transactions</h3>
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
                  <span className="ml-2 text-sm text-gray-600">Loading transactions...</span>
                </div>
              ) : recentTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No transactions found for this account</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTransactions.slice(0, 10).map((line: any) => (
                    <div key={line.id} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {line.journal_entries?.description || 'Journal Entry'}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(line.journal_entries?.entry_date).toLocaleDateString()}
                            {' • '}
                            {line.journal_entries?.reference_type?.replace(/_/g, ' ')}
                          </div>
                        </div>
                        <div className="text-right">
                          {line.debit > 0 ? (
                            <div className="text-sm font-bold text-emerald-600">
                              Debit: {formatCurrency(line.debit)}
                            </div>
                          ) : (
                            <div className="text-sm font-bold text-rose-600">
                              Credit: {formatCurrency(line.credit)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {recentTransactions.length > 10 && (
                    <div className="text-center pt-2">
                      <button
                        onClick={() => {
                          setShowTransactionModal(false);
                          window.location.hash = '#/ledger';
                        }}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        View all {recentTransactions.length} transactions in Ledger →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
        <div className="ml-3 text-sm text-gray-600">Loading account structure...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-red-900">Failed to Load Account Structure</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={fetchAccounts}
              className="mt-3 inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4" ref={containerRef}>
      {/* Historical View Banner */}
      {showHistoricalView && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-4 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6" />
              <div>
                <h3 className="font-bold text-lg">Historical View</h3>
                <p className="text-sm text-indigo-100">
                  Showing account structure as of {new Date(historicalDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            <button
              onClick={handleClearHistorical}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-all backdrop-blur-sm"
            >
              Return to Current View
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Structure Map</h1>
          <p className="text-sm text-gray-500 mt-1">
            Visual representation of your chart of accounts hierarchy and relationships
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleExportMap('json')}
            className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download className="h-4 w-4 mr-2 text-indigo-600" /> Export JSON
          </button>
          <button
            onClick={() => handleExportMap('csv')}
            className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <Printer className="h-4 w-4 mr-2 text-gray-600" /> Print
          </button>
          <button
            onClick={fetchAccounts}
            className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <RefreshCw className="h-4 w-4 mr-2 text-indigo-600" /> Refresh
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-2xl border border-emerald-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-500 rounded-lg">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Total Assets</div>
              <div className="text-2xl font-bold text-emerald-900 tabular-nums">
                {formatCurrency(totals.assets)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100 p-6 rounded-2xl border border-rose-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-rose-500 rounded-lg">
              <TrendingDown className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-rose-700 uppercase tracking-wider">Total Liabilities</div>
              <div className="text-2xl font-bold text-rose-900 tabular-nums">
                {formatCurrency(totals.liabilities)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">Net Worth</div>
              <div className="text-2xl font-bold text-blue-900 tabular-nums">
                {formatCurrency(totals.netWorth)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <PieChart className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-green-700 uppercase tracking-wider">Net Profit</div>
              <div className="text-2xl font-bold text-green-900 tabular-nums">
                {formatCurrency(totals.netProfit)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Controls */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 print:hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 w-full lg:w-auto">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search accounts... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            
            {/* Historical Date Picker */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={historicalDate}
                  onChange={(e) => setHistoricalDate(e.target.value)}
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  title="View account structure as of this date"
                />
              </div>
              <button
                onClick={handleViewHistorical}
                disabled={!historicalDate || loading}
                className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Compare
              </button>
              {showHistoricalView && (
                <button
                  onClick={handleClearHistorical}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                viewMode === 'hierarchy'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              Hierarchy
            </button>
            <button
              onClick={() => setViewMode('flowchart')}
              className={`inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                viewMode === 'flowchart'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Layers className="h-4 w-4 mr-2" />
              Flowchart
            </button>
            <button
              onClick={() => setViewMode('treemap')}
              className={`inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                viewMode === 'treemap'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CircleDollarSign className="h-4 w-4 mr-2" />
              Treemap
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="asset">Assets</option>
              <option value="liability">Liabilities</option>
              <option value="equity">Equity</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>

            {viewMode === 'hierarchy' && (
              <>
                <button
                  onClick={expandAll}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all"
                  title="Expand all nodes"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all"
                  title="Collapse all nodes"
                >
                  Collapse All
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Keyboard shortcuts help */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 bg-gray-100 rounded text-[10px] font-mono">Ctrl+K</kbd>
            <span>Search</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 bg-gray-100 rounded text-[10px] font-mono">↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 bg-gray-100 rounded text-[10px] font-mono">←→</kbd>
            <span>Expand/Collapse</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 bg-gray-100 rounded text-[10px] font-mono">Esc</kbd>
            <span>Close/Clear</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {viewMode === 'hierarchy' && (
          <div className="p-6">
            <div className="space-y-2">
              {filteredAccounts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <div className="text-sm">
                    {searchQuery ? 'No accounts match your search' : 'No accounts found for the selected category'}
                  </div>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                filteredAccounts.map(account => renderAccountNode(account))
              )}
            </div>
          </div>
        )}

        {viewMode === 'flowchart' && (
          <div className="p-6">
            {renderFlowchartView()}
          </div>
        )}

        {viewMode === 'treemap' && (
          <div className="p-6">
            <div className="mb-4">
              <h3 className="font-bold text-gray-900 text-lg mb-1">Account Balance Treemap</h3>
              <p className="text-sm text-gray-500">
                Visual representation of account balances by size. Larger rectangles = larger balances. Click any block to view transactions.
              </p>
            </div>
            {renderTreemap()}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:hidden">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          Account Type Legend
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(categoryConfig).map(([key, config]) => {
            const IconComponent = config.icon;
            return (
              <div key={key} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                <div className={`p-2 rounded-lg ${config.bgColor}`}>
                  <IconComponent className={`h-5 w-5 ${config.color}`} />
                </div>
                <div>
                  <div className="font-bold text-gray-900 capitalize text-sm">{key}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{config.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction Modal */}
      {renderTransactionModal()}
    </div>
  );
};

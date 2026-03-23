import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  // Define page titles
  const pageTitles: { [key: string]: string } = {
    '': 'Dashboard',
    'borrowers': 'Borrowers',
    'loans': 'Loans',
    'financial': 'Financial',
    'reports': 'Reporting',
    'users': 'Administration',
    'messages': 'Communication',
    'calculator': 'Tools',
    'profile': 'My Account',
    'analytics': 'Advanced Analytics',
    'compliance': 'Compliance Management',
    'financial-management': 'Financial Management'
  };

  type BreadcrumbItem = { name: string; href: string; icon?: React.ComponentType<any> };

  const breadcrumbs: BreadcrumbItem[] = [];

  // Add dashboard breadcrumb
  breadcrumbs.push({ name: 'Dashboard', href: '/', icon: Home });

  pathnames.forEach((pathname, index) => {
    const href = '/' + pathnames.slice(0, index + 1).join('/');
    const name = pageTitles[pathname] || pathname.charAt(0).toUpperCase() + pathname.slice(1).replace('-', ' ');
    breadcrumbs.push({ name, href });
  });

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6" aria-label="Breadcrumb">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.href}>
          {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-gray-900">{crumb.name}</span>
          ) : (
            <Link
              to={crumb.href}
              className="hover:text-indigo-600 transition-colors flex items-center space-x-1"
            >
              {crumb.icon && React.createElement(crumb.icon, { className: "h-4 w-4" })}
              <span>{crumb.name}</span>
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
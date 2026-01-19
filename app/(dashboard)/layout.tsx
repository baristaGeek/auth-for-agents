'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email || null);
    };
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊', disabled: false },
    { name: 'Agents', href: '/agents', icon: '🤖', disabled: false },
    { name: 'Approvals', href: '/approvals', icon: '✓', disabled: false },
    { name: 'Rules', href: '/rules', icon: '⚙️', disabled: false },
    { name: 'Fine-grained Auth for RAG', href: '#', icon: '🔍', disabled: true, badge: 'Coming Soon' },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Auth for Agents
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
              Manage AI agent access
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const Component = item.disabled ? 'div' : Link;
              return (
                <Component
                  key={item.name}
                  {...(!item.disabled ? { href: item.href } : {})}
                  className={`flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    item.disabled
                      ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-60'
                      : isActive(item.href)
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="mr-3 text-lg">{item.icon}</span>
                    {item.name}
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded">
                      {item.badge}
                    </span>
                  )}
                </Component>
              );
            })}
          </nav>

          {/* User menu */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="mb-2">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className={cn(
        "no-print rounded-lg p-2 transition-colors",
        "hover:bg-gray-200 dark:hover:bg-gray-700",
        "text-gray-600 dark:text-gray-400"
      )}
      title={dark ? 'Mode clair' : 'Mode sombre'}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

import React, { useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './Sheet';
import ResultInfo from './ResultInfo';
import type { Control } from '@/types/audit';

interface DetailPanelProps {
  control: Control | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateNext?: () => void;
  onNavigatePrevious?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

function DetailPanel({
  control,
  isOpen,
  onClose,
  onNavigateNext,
  onNavigatePrevious,
  currentIndex,
  totalCount,
}: DetailPanelProps) {
  const handleKeyboard = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNavigateNext?.();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onNavigatePrevious?.();
      }
    },
    [isOpen, onNavigateNext, onNavigatePrevious]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyboard);
      return () => window.removeEventListener('keydown', handleKeyboard);
    }
  }, [isOpen, handleKeyboard]);

  if (!control) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto"
      >
        {/* Navigation buttons — same position as Maester */}
        <div className="absolute left-10 top-4 flex items-center gap-1">
          <button
            onClick={onNavigatePrevious}
            disabled={!onNavigatePrevious}
            className="rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-30"
            title="Résultat précédent (flèche gauche)"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Précédent</span>
          </button>
          {currentIndex !== undefined && totalCount !== undefined && (
            <span className="text-xs text-muted-foreground px-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {currentIndex}/{totalCount}
            </span>
          )}
          <button
            onClick={onNavigateNext}
            disabled={!onNavigateNext}
            className="rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-30"
            title="Résultat suivant (flèche droite)"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Suivant</span>
          </button>
        </div>

        <SheetHeader className="sr-only">
          <SheetTitle>{control.title}</SheetTitle>
          <SheetDescription>Détails du contrôle d'audit</SheetDescription>
        </SheetHeader>

        <div className="mt-2">
          <ResultInfo control={control} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default React.memo(DetailPanel);

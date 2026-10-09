'use client';

import { useEffect, useRef } from 'react';
import { ChevronDown, Plus, Share2, Star, Trash2, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface SheetTab {
  name: string;
  label: string;
  count: number;
  favorites?: boolean;
  sharedWithMe?: boolean;
  canShare?: boolean;
  canDelete?: boolean;
}

interface SheetTabsProps {
  tabs: SheetTab[];
  active: string;
  searching: boolean;
  onSelect: (name: string) => void;
  onAdd: () => void;
  onShare: (name: string) => void;
  onDelete: (name: string) => void;
}

export function SheetTabs({ tabs, active, searching, onSelect, onAdd, onShare, onDelete }: SheetTabsProps) {
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  return (
    <div className="flex items-stretch h-10 bg-[#f1f3f4] border-t border-[#dadce0] shrink-0">
      <button type="button" onClick={onAdd} className="px-3 text-[#5f6368] hover:bg-[#e2e3e3]" title="Nova categoria">
        <Plus size={18} />
      </button>
      <div className="flex items-stretch overflow-x-auto [scrollbar-width:thin]">
        {tabs.map(tab => {
          const isActive = tab.name === active;
          const dimmed = searching && tab.count === 0;
          return (
            <div
              key={tab.name}
              ref={isActive ? activeRef : undefined}
              className={cn(
                'flex items-center shrink-0 border-r border-[#dadce0] text-[13px]',
                isActive ? 'bg-white text-[#188038] font-semibold shadow-[inset_0_-3px_0_#188038]' : 'text-[#3c4043] hover:bg-[#e8eaed]',
                dimmed && !isActive && 'opacity-50',
              )}
            >
              <button type="button" onClick={() => onSelect(tab.name)} className="flex items-center gap-1.5 h-full pl-3 pr-2">
                {tab.favorites && <Star size={13} className="text-yellow-500" fill="currentColor" />}
                {tab.sharedWithMe && <Users size={13} className="text-accent" />}
                <span>{tab.label}</span>
                <span className={cn('text-[11px] font-normal rounded px-1', isActive ? 'bg-[#e6f4ea]' : 'bg-[#e2e3e3]')}>{tab.count}</span>
              </button>
              {isActive && (tab.canShare || tab.canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="h-full pr-2 text-[#5f6368] hover:text-foreground" title="Opções da categoria">
                      <ChevronDown size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start">
                    {tab.canShare && (
                      <DropdownMenuItem onSelect={() => onShare(tab.name)}>
                        <Share2 size={14} className="mr-2" /> Compartilhar com grupo
                      </DropdownMenuItem>
                    )}
                    {tab.canDelete && (
                      <DropdownMenuItem onSelect={() => onDelete(tab.name)} className="text-destructive focus:text-destructive">
                        <Trash2 size={14} className="mr-2" /> Excluir categoria vazia
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

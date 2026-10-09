'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import type { PasswordEntry, Group } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowDown, ArrowUp, Check, ExternalLink, Eye, EyeOff, FolderOpen, Pencil, SearchX, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Labels that hold old passwords: never shown as columns nor searched.
const SECRET_LABEL = /senha/i;

const FIXED_COLUMNS = ['nome', 'ip', 'login', 'senha'];
const PREFERRED_ORDER = ['acesso', 'url', 'funcao', 'função', 'versão', 'versao', 'modelo', 'status', 'porta', 'tipo de acesso', 'banco', 'servidor'];
const LAST_COLUMNS = ['obs', 'descrição', 'descricao'];
const HEADER_NAMES: Record<string, string> = {
  nome: 'Nome', ip: 'IP', login: 'Usuário', senha: 'Senha', categoria: 'Categoria', url: 'URL',
  funcao: 'Função', 'versão': 'Versão', obs: 'Obs',
};

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function searchTerms(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function customValue(entry: PasswordEntry, key: string): string {
  const field = entry.customFields?.find(f => f.label?.trim().toLowerCase() === key);
  return field?.value?.trim() ?? '';
}

function cellValue(entry: PasswordEntry, key: string): string {
  switch (key) {
    case 'nome': return entry.nome ?? '';
    case 'login': return entry.login ?? '';
    case 'senha': return entry.senha ?? '';
    case 'categoria': return entry.sharedVia?.categoryName || entry.categoria || '';
    default: return customValue(entry, key);
  }
}

export function matchesSearch(entry: PasswordEntry, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = normalize([
    entry.nome, entry.login, entry.categoria, entry.sharedVia?.categoryName, entry.sharedVia?.groupName,
    ...(entry.customFields ?? []).filter(f => !SECRET_LABEL.test(f.label ?? '')).map(f => f.value),
  ].filter(Boolean).join(' \u0000 '));
  return terms.every(t => haystack.includes(t));
}

export function canManageEntry(entry: PasswordEntry, currentUserId: string, userGroups: Group[]): boolean {
  if ((entry.ownerId || entry.userId) === currentUserId) return true;
  const group = entry.sharedVia && userGroups.find(g => g.id === entry.sharedVia!.groupId);
  return !!group && group.members.some(m => m.userId === currentUserId && m.role === 'admin');
}

function headerName(key: string, original: string): string {
  if (HEADER_NAMES[key]) return HEADER_NAMES[key];
  return original.charAt(0).toUpperCase() + original.slice(1).toLowerCase();
}

function highlight(text: string, terms: string[]): ReactNode {
  if (!text || terms.length === 0) return text;
  const norm = normalize(text);
  const marks = new Array(text.length).fill(false);
  for (const t of terms) {
    for (let i = norm.indexOf(t); i !== -1; i = norm.indexOf(t, i + 1)) {
      for (let j = i; j < i + t.length && j < marks.length; j++) marks[j] = true;
    }
  }
  const parts: ReactNode[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marks[i] !== marks[start]) {
      const chunk = text.slice(start, i);
      parts.push(marks[start] ? <mark key={start} className="bg-yellow-200 text-inherit rounded-sm">{chunk}</mark> : <Fragment key={start}>{chunk}</Fragment>);
      start = i;
    }
  }
  return parts;
}

interface Column { key: string; label: string; }

interface PasswordGridProps {
  passwords: PasswordEntry[];
  isLoading: boolean;
  searchTerm: string;
  showCategory: boolean;
  currentUserId: string;
  userGroups: Group[];
  onEdit: (entry: PasswordEntry) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (entry: PasswordEntry) => void;
}

export function PasswordGrid({ passwords, isLoading, searchTerm, showCategory, currentUserId, userGroups, onEdit, onDelete, onToggleFavorite }: PasswordGridProps) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'nome', dir: 1 });
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PasswordEntry | null>(null);
  const terms = useMemo(() => searchTerms(searchTerm), [searchTerm]);

  const columns = useMemo<Column[]>(() => {
    const counts = new Map<string, { label: string; n: number }>();
    for (const p of passwords) {
      for (const f of p.customFields ?? []) {
        const key = f.label?.trim().toLowerCase();
        if (!key || !f.value?.trim() || SECRET_LABEL.test(key) || FIXED_COLUMNS.includes(key)) continue;
        const c = counts.get(key);
        counts.set(key, { label: c?.label ?? f.label.trim(), n: (c?.n ?? 0) + 1 });
      }
    }
    const rank = (k: string) => {
      if (LAST_COLUMNS.includes(k)) return 1000 + LAST_COLUMNS.indexOf(k);
      const i = PREFERRED_ORDER.indexOf(k);
      return i === -1 ? 100 : i;
    };
    const extra = Array.from(counts.entries())
      .sort(([a, ca], [b, cb]) => rank(a) - rank(b) || cb.n - ca.n)
      .map(([key, c]) => ({ key, label: headerName(key, c.label) }));
    const fixed = FIXED_COLUMNS
      .filter(k => k !== 'ip' || passwords.some(p => customValue(p, 'ip')))
      .map(key => ({ key, label: headerName(key, key) }));
    return [...fixed, ...(showCategory ? [{ key: 'categoria', label: 'Categoria' }] : []), ...extra];
  }, [passwords, showCategory]);

  const rows = useMemo(() => {
    const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
    return [...passwords].sort((a, b) => {
      const va = cellValue(a, sort.key), vb = cellValue(b, sort.key);
      if (!va !== !vb) return va ? -1 : 1;
      return sort.dir * collator.compare(va, vb) || collator.compare(a.nome, b.nome);
    });
  }, [passwords, sort]);

  const copy = (value: string, id: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(c => (c === id ? null : c)), 1200);
    });
  };

  const toggleReveal = (id: string) => setRevealed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleSort = (key: string) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 p-8 text-center">
        {searchTerm ? <SearchX size={40} /> : <FolderOpen size={40} />}
        <p className="font-medium">{searchTerm ? `Nada encontrado para "${searchTerm}".` : 'Nenhuma senha nesta aba.'}</p>
        {searchTerm && <p className="text-sm">A busca procura em todas as abas: nome, IP, usuário, acesso e demais campos.</p>}
      </div>
    );
  }

  const th = 'sticky top-0 z-10 bg-[#f8f9fa] border-b border-r border-[#e2e3e3] px-2 h-8 text-left text-xs font-semibold text-[#444] whitespace-nowrap select-none';
  const td = 'border-b border-r border-[#e2e3e3] px-2 h-8 text-[13px] whitespace-nowrap';

  return (
    <div className="h-full overflow-auto bg-white">
      <table className="border-separate border-spacing-0 min-w-full">
        <thead>
          <tr>
            <th className={cn(th, 'left-0 z-20 w-10 text-center text-[#888]')}>#</th>
            <th className={cn(th, 'w-8 px-0')} aria-label="Favorita" />
            {columns.map(col => (
              <th key={col.key} className={cn(th, 'cursor-pointer hover:bg-[#eef0f2]')} onClick={() => toggleSort(col.key)}>
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sort.key === col.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </span>
              </th>
            ))}
            <th className={cn(th, 'w-16 border-r-0')} aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {rows.map((entry, index) => {
            const canManage = canManageEntry(entry, currentUserId, userGroups);
            return (
              <tr key={entry.id} className="group hover:bg-[#e8f0fe]/60" onDoubleClick={() => canManage && onEdit(entry)}>
                <td className={cn(td, 'sticky left-0 bg-[#f8f9fa] group-hover:bg-[#e8eaed] text-center text-xs text-[#888] w-10')}>{index + 1}</td>
                <td className={cn(td, 'px-0 w-8 text-center')}>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => onToggleFavorite(entry)}
                    className={cn('p-1 rounded disabled:opacity-40', entry.isFavorite ? 'text-yellow-500' : 'text-[#c4c7c5] hover:text-yellow-500')}
                    title={entry.isFavorite ? 'Remover das favoritas' : 'Marcar como favorita'}
                  >
                    <Star size={14} fill={entry.isFavorite ? 'currentColor' : 'none'} />
                  </button>
                </td>
                {columns.map(col => {
                  const value = cellValue(entry, col.key);
                  const id = `${entry.id}:${col.key}`;
                  const isCopied = copied === id;
                  if (col.key === 'senha') {
                    const shown = revealed.has(entry.id);
                    return (
                      <td key={col.key} className={cn(td, 'font-mono cursor-copy relative', isCopied && 'bg-green-100')} onClick={() => copy(value, id)} title={value ? 'Clique para copiar a senha' : undefined}>
                        <span className="inline-flex items-center gap-1 w-full">
                          <span className="truncate max-w-[220px]">{value ? (shown ? value : '••••••••') : ''}</span>
                          {value && (
                            <button
                              type="button"
                              className="ml-auto p-0.5 text-[#888] hover:text-foreground"
                              onClick={e => { e.stopPropagation(); toggleReveal(entry.id); }}
                              title={shown ? 'Esconder' : 'Mostrar'}
                            >
                              {shown ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          )}
                          {isCopied && <Check size={13} className="text-green-700" />}
                        </span>
                      </td>
                    );
                  }
                  const isLink = /^https?:\/\//i.test(value);
                  return (
                    <td
                      key={col.key}
                      className={cn(td, 'cursor-copy', col.key === 'nome' && 'font-medium', col.key === 'ip' && 'font-mono text-xs', isCopied && 'bg-green-100')}
                      onClick={() => copy(value, id)}
                      title={value || undefined}
                    >
                      <span className="inline-flex items-center gap-1 max-w-[280px]">
                        <span className="truncate">{highlight(value, terms)}</span>
                        {isLink && (
                          <a href={value} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[#1a73e8] hover:text-[#174ea6] shrink-0" title="Abrir">
                            <ExternalLink size={12} />
                          </a>
                        )}
                        {isCopied && <Check size={13} className="text-green-700 shrink-0" />}
                      </span>
                    </td>
                  );
                })}
                <td className={cn(td, 'border-r-0 w-16')}>
                  {canManage && (
                    <span className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(entry)} title="Editar">
                        <Pencil size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setPendingDelete(entry)} title="Excluir">
                        <Trash2 size={13} />
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <AlertDialog open={!!pendingDelete} onOpenChange={open => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{pendingDelete?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>A senha será marcada como excluída e sairá da lista.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (pendingDelete) onDelete(pendingDelete.id); setPendingDelete(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

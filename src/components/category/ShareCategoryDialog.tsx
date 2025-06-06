
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Group, CategoryShare } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ListChecks, Share2, ShieldCheck, Trash2, Loader2 } from 'lucide-react'; // Added Loader2
import { Separator } from '../ui/separator';

interface ShareCategoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  ownerId: string;
  userGroups: Group[];
  onShareCategoryWithGroup: (categoryName: string, groupId: string) => Promise<CategoryShare | undefined>;
  onUnshareCategoryFromGroup: (categoryName: string, groupId: string) => Promise<void>;
  fetchCategorySharesForOwner: (categoryName: string, ownerId: string) => Promise<CategoryShare[]>;
}

export function ShareCategoryDialog({
  isOpen,
  onOpenChange,
  categoryName,
  ownerId,
  userGroups,
  onShareCategoryWithGroup,
  onUnshareCategoryFromGroup,
  fetchCategorySharesForOwner,
}: ShareCategoryDialogProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [sharedWithGroups, setSharedWithGroups] = useState<CategoryShare[]>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const loadShares = useCallback(async () => {
    if (!isOpen || !categoryName || !ownerId || typeof fetchCategorySharesForOwner !== 'function') {
        if (!isOpen) setSharedWithGroups([]);
        return;
    }
    setIsLoadingShares(true);
    try {
      const shares = await fetchCategorySharesForOwner(categoryName, ownerId);
      setSharedWithGroups(shares);
    } catch (error: any) {
      console.error("ShareCategoryDialog: Error loading shares:", error);
      toast({ title: "Erro ao Carregar Compartilhamentos", description: error.message || "Não foi possível buscar os compartilhamentos da categoria.", variant: "destructive" });
      setSharedWithGroups([]);
    } finally {
      setIsLoadingShares(false);
    }
  }, [isOpen, categoryName, ownerId, fetchCategorySharesForOwner, toast]);

  useEffect(() => {
    if (isOpen) {
        loadShares();
    } else {
        setSelectedGroupId('');
        setSharedWithGroups([]);
        setIsLoadingShares(false);
        setIsSubmitting(false);
    }
  }, [isOpen, loadShares]);


  const handleShare = async () => {
    if (!selectedGroupId) {
      toast({ title: "Nenhum Grupo Selecionado", description: "Por favor, selecione um grupo.", variant: "destructive" });
      return;
    }
    if (typeof onShareCategoryWithGroup !== 'function') {
      console.error("ShareCategoryDialog: onShareCategoryWithGroup is not a function. Value:", onShareCategoryWithGroup);
      toast({ title: "Erro Interno", description: "Ação de compartilhar não está disponível.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const newShare = await onShareCategoryWithGroup(categoryName, selectedGroupId);
      if (newShare) {
        toast({ title: "Sucesso!", description: `Categoria "${categoryName}" compartilhada com o grupo.` });
        setSelectedGroupId(''); 
        await loadShares(); 
      }
    } catch (error: any) {
      toast({ title: "Erro ao Compartilhar", description: error.message || "Não foi possível compartilhar a categoria.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnshare = async (groupIdToUnshare: string) => {
    if (typeof onUnshareCategoryFromGroup !== 'function') {
      console.error("ShareCategoryDialog: onUnshareCategoryFromGroup is not a function. Value:", onUnshareCategoryFromGroup);
      toast({ title: "Erro Interno", description: "Ação de remover compartilhamento não está disponível.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await onUnshareCategoryFromGroup(categoryName, groupIdToUnshare);
      toast({ title: "Sucesso!", description: `Compartilhamento da categoria "${categoryName}" removido do grupo.` });
      await loadShares(); 
    } catch (error: any) {
      toast({ title: "Erro ao Remover Compartilhamento", description: error.message || "Não foi possível remover o compartilhamento.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableGroupsToShareWith = userGroups.filter(
    ug => !sharedWithGroups.some(swg => swg.groupId === ug.id)
  );


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmitting && !isLoadingShares) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-lg md:max-w-xl bg-card max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary flex items-center gap-2">
            <Share2 size={22} /> Compartilhar Categoria
          </DialogTitle>
          <DialogDescription>
            Compartilhe a categoria <span className="font-semibold">"{categoryName}"</span> (e todas as senhas dentro dela que você possui) com seus grupos.
            Apenas você, como proprietário da categoria, pode iniciar ou remover compartilhamentos.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow pr-3 -mr-3 my-2 text-sm">
          <div className="space-y-6 py-2">
            <div className="p-4 border rounded-md bg-muted/30 space-y-3">
              <h3 className="text-md font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck size={18} /> Compartilhar com um Novo Grupo
              </h3>
              {isLoadingShares ? (
                 <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground text-xs">Carregando dados...</span>
                 </div>
              ) : availableGroupsToShareWith.length > 0 ? (
                <>
                  <div>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId} disabled={isSubmitting || isLoadingShares}>
                      <SelectTrigger id="groupIdToShareWith" className="mt-1 h-9">
                        <SelectValue placeholder="Selecione um grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableGroupsToShareWith.map(group => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleShare} className="w-full" disabled={isSubmitting || isLoadingShares || !selectedGroupId}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSubmitting ? "Compartilhando..." : "Compartilhar com Grupo Selecionado"}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground p-2 bg-background/50 rounded-md">
                  {userGroups.length === 0 ? "Você não possui grupos para compartilhar ou eles não puderam ser carregados." : "Esta categoria já está compartilhada com todos os seus grupos disponíveis ou eles não puderam ser carregados."}
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-md font-semibold text-foreground flex items-center gap-2">
                <ListChecks size={18} /> Compartilhado Atualmente Com:
              </h3>
              {isLoadingShares ? (
                 <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground text-xs">Carregando compartilhamentos...</span>
                 </div>
              ) : !sharedWithGroups || sharedWithGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 bg-muted/20 rounded-md flex items-center gap-2">
                  <AlertCircle size={16} /> Esta categoria ainda não foi compartilhada com nenhum grupo.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sharedWithGroups.map((share) => {
                    const group = userGroups.find(ug => ug.id === share.groupId);
                    return (
                      <li key={share.groupId} className="p-3 border rounded-md bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-grow min-w-0">
                          <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-muted-foreground shrink-0" />
                            {group?.name || `Grupo (ID: ...${share.groupId.slice(-6)})`}
                          </p>
                          <p className="text-xs text-muted-foreground">Compartilhado em: {new Date(share.sharedAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 mt-2 sm:mt-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUnshare(share.groupId)}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                            disabled={isSubmitting || isLoadingShares}
                            aria-label={`Remover compartilhamento com grupo ${group?.name || share.groupId}`}
                          >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={16} />}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="border-t pt-4">
            <DialogClose asChild>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting || isLoadingShares}>Fechar</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


'use client';

import { useState } from 'react';
import { usePasswordManager } from '@/hooks/usePasswordManager';
import type { PasswordEntry } from '@/types';
import { Header } from '@/components/layout/Header';
import { PasswordList } from '@/components/password/PasswordList';
import { AddEditPasswordDialog, type PasswordFormValues } from '@/components/password/AddEditPasswordDialog';
import { ImportPasswordsDialog } from '@/components/password/ImportPasswordsDialog';
import { PasswordGeneratorDialog } from '@/components/password/PasswordGeneratorDialog';
import { ClearAllPasswordsDialog } from '@/components/password/ClearAllPasswordsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Upload, Zap, Search, ShieldAlert, Trash2, FileDown } from 'lucide-react';

export default function HomePage() {
  const { 
    passwords, 
    isLoading, 
    addPassword, 
    updatePassword, 
    deletePassword, 
    importPasswords: importPasswordsHook, 
    generatePassword,
    clearAllPasswords,
    exportPasswordsToCSV,
  } = usePasswordManager();
  const { toast } = useToast();

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isGeneratorDialogOpen, setIsGeneratorDialogOpen] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState<PasswordEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddPassword = (data: PasswordFormValues) => {
    const entryToAdd: Omit<PasswordEntry, 'id'> = {
      nome: data.nome,
      login: data.login,
      senha: data.senha,
      customFields: data.customFields || [],
    };
    addPassword(entryToAdd);
    toast({ title: "Sucesso!", description: `Senha para "${data.nome}" adicionada.` });
  };

  const handleUpdatePassword = (data: PasswordFormValues, id: string) => {
    const entryToUpdate: PasswordEntry = {
      id,
      nome: data.nome,
      login: data.login,
      senha: data.senha,
      customFields: data.customFields || [],
    };
    updatePassword(entryToUpdate);
    toast({ title: "Sucesso!", description: `Senha para "${data.nome}" atualizada.` });
  };

  const handleSubmitPasswordForm = (data: PasswordFormValues, id?: string) => {
    if (id) {
      handleUpdatePassword(data, id);
    } else {
      handleAddPassword(data);
    }
    setEditingPassword(null);
    setIsAddEditDialogOpen(false); // Close dialog after submit
  };

  const handleEditPassword = (entry: PasswordEntry) => {
    setEditingPassword(entry);
    setIsAddEditDialogOpen(true);
  };

  const handleDeletePassword = (id: string) => {
    const entryToDelete = passwords.find(p => p.id === id);
    deletePassword(id);
    if (entryToDelete) {
      toast({ title: "Sucesso!", description: `Senha para "${entryToDelete.nome}" deletada.`, variant: "destructive" });
    }
  };

  const handleImport = (entries: Array<Omit<PasswordEntry, 'id'>>) => {
    const imported = importPasswordsHook(entries);
    if (imported.length > 0) {
         toast({ title: "Importação Concluída", description: `${imported.length} novas senhas importadas com sucesso.` });
    } else {
         toast({ title: "Nenhuma Nova Senha", description: "Nenhuma senha nova foi importada. Podem ser duplicatas ou o arquivo estar vazio.", variant: "default" });
    }
  };
  
  const handleClearAllPasswords = () => {
    clearAllPasswords();
    toast({ title: "Tudo Limpo!", description: "Todas as senhas foram removidas.", variant: "destructive" });
    setIsClearAllDialogOpen(false);
  };

  const handleExportPasswords = () => {
    if (passwords.length === 0) {
      toast({ title: "Nada para Exportar", description: "Não há senhas para exportar.", variant: "default" });
      return;
    }
    const success = exportPasswordsToCSV();
    if (success) {
      toast({ title: "Exportado!", description: "Suas senhas foram exportadas para senhas_backup.csv." });
    } else {
      toast({ title: "Erro na Exportação", description: "Não foi possível exportar as senhas.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container mx-auto py-8 px-4 flex-grow">
        <div className="mb-6 p-4 border border-yellow-300 bg-yellow-50 rounded-md shadow">
            <div className="flex items-center">
                <ShieldAlert className="h-6 w-6 text-yellow-600 mr-3" />
                <div>
                    <h3 className="text-md font-semibold text-yellow-800 font-headline">Aviso de Segurança</h3>
                    <p className="text-sm text-yellow-700">
                        Este aplicativo armazena senhas localmente no seu navegador. Para maior segurança, use senhas mestras fortes e considere gerenciadores de senha com criptografia ponta-a-ponta para dados críticos. Não use em computadores compartilhados.
                    </p>
                </div>
            </div>
        </div>

        <div className="mb-8 p-6 bg-card rounded-lg shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="relative md:col-span-1">
              <Input
                type="search"
                placeholder="Pesquisar senhas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
              <Button onClick={() => { setEditingPassword(null); setIsAddEditDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
                <PlusCircle size={18} className="mr-2" /> Adicionar Nova
              </Button>
              <Button onClick={() => setIsImportDialogOpen(true)} variant="outline" className="hover:bg-secondary">
                <Upload size={18} className="mr-2" /> Importar CSV
              </Button>
               <Button onClick={handleExportPasswords} variant="outline" className="hover:bg-secondary">
                <FileDown size={18} className="mr-2" /> Exportar CSV
              </Button>
              <Button onClick={() => setIsGeneratorDialogOpen(true)} variant="outline" className="hover:bg-secondary">
                <Zap size={18} className="mr-2" /> Gerar Senha
              </Button>
              <Button onClick={() => setIsClearAllDialogOpen(true)} variant="default" className="bg-primary hover:bg-primary/90">
                <Trash2 size={18} className="mr-2" /> Limpar Tudo
              </Button>
            </div>
          </div>
        </div>

        <PasswordList
          passwords={passwords}
          isLoading={isLoading}
          onEdit={handleEditPassword}
          onDelete={handleDeletePassword}
          searchTerm={searchTerm}
        />
      </main>

      <AddEditPasswordDialog
        isOpen={isAddEditDialogOpen}
        onOpenChange={(open) => {
          setIsAddEditDialogOpen(open);
          if (!open) setEditingPassword(null); // Clear editing state when dialog closes
        }}
        onSubmit={handleSubmitPasswordForm}
        initialData={editingPassword}
      />
      <ImportPasswordsDialog
        isOpen={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImport={handleImport}
      />
      <PasswordGeneratorDialog
        isOpen={isGeneratorDialogOpen}
        onOpenChange={setIsGeneratorDialogOpen}
        generatePasswordFunc={generatePassword}
      />
      <ClearAllPasswordsDialog
        isOpen={isClearAllDialogOpen}
        onOpenChange={setIsClearAllDialogOpen}
        onConfirm={handleClearAllPasswords}
      />
      <footer className="text-center py-4 text-sm text-muted-foreground border-t mt-auto">
        SenhaFacil &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

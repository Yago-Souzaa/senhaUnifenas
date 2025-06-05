
'use client';

import { useState, useEffect } from 'react';
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
import { PlusCircle, Upload, Zap, Search, ShieldAlert, Trash2, FileDown, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function HomePage() {
  const { 
    passwords, 
    isLoading, 
    error: passwordManagerError, // Get error from hook
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
  const [showSecurityNotice, setShowSecurityNotice] = useState(true);


  const handleAddPassword = async (data: PasswordFormValues) => {
    const entryToAdd: Omit<PasswordEntry, 'id'> = {
      nome: data.nome,
      login: data.login,
      senha: data.senha,
      categoria: data.categoria,
      customFields: data.customFields || [],
    };
    try {
      await addPassword(entryToAdd);
      toast({ title: "Sucesso!", description: `Senha para "${data.nome}" adicionada.` });
    } catch (e: any) {
      toast({ title: "Erro ao Adicionar", description: e.message || "Não foi possível adicionar a senha.", variant: "destructive" });
    }
  };

  const handleUpdatePassword = async (data: PasswordFormValues, id: string) => {
    const entryToUpdate: PasswordEntry = {
      id,
      nome: data.nome,
      login: data.login,
      senha: data.senha,
      categoria: data.categoria,
      customFields: data.customFields || [],
    };
    try {
      await updatePassword(entryToUpdate);
      toast({ title: "Sucesso!", description: `Senha para "${data.nome}" atualizada.` });
    } catch (e: any) {
      toast({ title: "Erro ao Atualizar", description: e.message || "Não foi possível atualizar a senha.", variant: "destructive" });
    }
  };

  const handleSubmitPasswordForm = async (data: PasswordFormValues, id?: string) => {
    if (id) {
      await handleUpdatePassword(data, id);
    } else {
      await handleAddPassword(data);
    }
    setEditingPassword(null);
    setIsAddEditDialogOpen(false); 
  };

  const handleEditPassword = (entry: PasswordEntry) => {
    setEditingPassword(entry);
    setIsAddEditDialogOpen(true);
  };

  const handleDeletePassword = async (id: string) => {
    const entryToDelete = passwords.find(p => p.id === id);
    try {
      await deletePassword(id);
      if (entryToDelete) {
        toast({ title: "Sucesso!", description: `Senha para "${entryToDelete.nome}" deletada.`, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao Deletar", description: e.message || "Não foi possível deletar a senha.", variant: "destructive" });
    }
  };

  // Updated to use the new hook return type
  const handleImport = async (file: File) => {
    if (!file) {
      toast({ title: "Nenhum arquivo", description: "Por favor, selecione um arquivo para importar.", variant: "destructive" });
      return;
    }
    try {
      const result = await importPasswordsHook(file);
      if (result.importedCount > 0) {
           toast({ title: "Importação Concluída", description: `${result.importedCount} novas senhas importadas com sucesso.` });
      } else {
           toast({ title: "Nenhuma Nova Senha", description: result.message || "Nenhuma senha nova foi importada. Podem ser duplicatas ou o arquivo estar vazio.", variant: "default" });
      }
      setIsImportDialogOpen(false); // Close dialog on success/handled case
    } catch (e: any) {
         toast({ title: "Erro na Importação", description: e.message || "Falha ao processar o arquivo CSV.", variant: "destructive" });
    }
  };
  
  const handleClearAllPasswords = async () => {
    try {
      await clearAllPasswords();
      toast({ title: "Tudo Limpo!", description: "Todas as senhas foram removidas.", variant: "destructive" });
      setIsClearAllDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao Limpar", description: e.message || "Não foi possível limpar todas as senhas.", variant: "destructive" });
    }
  };

  const handleExportPasswords = async () => {
    if (passwords.length === 0) {
      toast({ title: "Nada para Exportar", description: "Não há senhas para exportar.", variant: "default" });
      return;
    }
    const success = await exportPasswordsToCSV();
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
        {showSecurityNotice && (
          <div className="mb-6 p-4 border border-yellow-300 bg-yellow-50 rounded-md shadow relative">
              <div className="flex items-start">
                  <ShieldAlert className="h-6 w-6 text-yellow-600 mr-3 shrink-0" />
                  <div className="flex-grow">
                      <h3 className="text-md font-semibold text-yellow-800 font-headline">Aviso de Segurança</h3>
                      <p className="text-sm text-yellow-700">
                          Este aplicativo agora armazena senhas em um banco de dados central. Certifique-se de que o acesso ao banco de dados e à aplicação esteja devidamente protegido conforme as políticas da sua intranet.
                      </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowSecurityNotice(false)} className="ml-2 h-6 w-6 text-yellow-600 hover:text-yellow-800 absolute top-2 right-2">
                      <XCircle size={18} />
                  </Button>
              </div>
          </div>
        )}

        {passwordManagerError && (
          <Alert variant="destructive" className="mb-4">
            <ShieldAlert className="h-5 w-5" />
            <AlertTitle>Erro de Conexão</AlertTitle>
            <AlertDescription>
              {passwordManagerError} Verifique a conexão com o banco de dados ou as configurações da API.
            </AlertDescription>
          </Alert>
        )}

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
          if (!open) setEditingPassword(null);
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

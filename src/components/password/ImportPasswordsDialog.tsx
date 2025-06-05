
'use client';

import { useState, ChangeEvent } from 'react';
// PasswordEntry type is no longer directly needed here as parsing logic is server-side
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, FileText, Download, Columns } from 'lucide-react';

interface ImportPasswordsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File) => Promise<void>; // Changed to accept File and expect Promise
}

const BASE_REQUIRED_HEADERS = ["nome", "login"];
// Example optional and custom fields for the model CSV
const COMMON_OPTIONAL_HEADERS = ["senha", "categoria", "exemplo_campo_1", "exemplo_campo_2"];


export function ImportPasswordsDialog({ isOpen, onOpenChange, onImport }: ImportPasswordsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false); // Renamed to isProcessing or similar might be better
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    } else {
      setFile(null);
    }
  };

  // CSV parsing logic is now handled by the API. This dialog just uploads the file.
  const handleImportClick = async () => {
    if (!file) {
      toast({ title: "Nenhum arquivo selecionado", description: "Por favor, selecione um arquivo CSV.", variant: "destructive" });
      return;
    }

    setIsParsing(true);
    try {
      await onImport(file); // Call the onImport (HomePage.handleImport) which calls the hook
      // Toasts for success/specific import counts are now handled in HomePage.handleImport
      // after the API call completes.
      // Dialog can be closed from HomePage.handleImport if successful.
      // onOpenChange(false); // Consider if HomePage should control this
      setFile(null); // Reset file input
    } catch (error: any) {
      // This toast is for errors during the API call itself, propagated from HomePage or the hook.
      // Or, if onImport doesn't throw but HomePage shows a toast, this might be redundant.
      // For now, let HomePage handle specific import error toasts.
      // toast({ title: "Erro na Importação", description: error.message || "Falha ao processar o arquivo CSV.", variant: "destructive" });
      // Error is caught and toasted in HomePage's handleImport
    } finally {
      setIsParsing(false);
    }
  };

  const triggerFileInput = () => {
    document.getElementById('csv-file-input')?.click();
  };

  const handleDownloadModel = () => {
    const exampleHeaders = [...BASE_REQUIRED_HEADERS, ...COMMON_OPTIONAL_HEADERS];
    const csvHeader = exampleHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
    
    const exampleDataRowValues = [
        "App Exemplo XYZ", // nome
        "usuario@exemplo.com", // login
        "s3nh@F0rt3!", // senha
        "Servidores Internos", // categoria
        "192.168.1.100", // exemplo_campo_1 (e.g. IP)
        "Porta 8080" // exemplo_campo_2 (e.g. Porta)
    ];
     // Ensure exampleRowData has the same number of elements as exampleHeaders
    while (exampleDataRowValues.length < exampleHeaders.length) {
        exampleDataRowValues.push(""); // Add empty strings for any remaining example headers
    }
    const exampleRow = exampleDataRowValues.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    
    const csvContent = csvHeader + '\r\n' + exampleRow;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "modelo_importacao_senhas.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({title: "Modelo Baixado", description: "modelo_importacao_senhas.csv foi baixado."})
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) setFile(null); }}>
      <DialogContent className="sm:max-w-md md:max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary flex items-center gap-2"><Columns size={20} /> Importar Senhas de CSV</DialogTitle>
          <DialogDescription>
            Selecione um arquivo CSV. A primeira linha deve ser o cabeçalho. <br />
            Colunas obrigatórias: <code className="text-xs bg-muted p-1 rounded">{BASE_REQUIRED_HEADERS.join(', ')}</code>.<br />
            As colunas <code className="text-xs bg-muted p-1 rounded">senha</code> e <code className="text-xs bg-muted p-1 rounded">categoria</code> são opcionais e recomendadas.<br />
            **Todas as outras colunas** no seu CSV (além de nome, login, senha, categoria) serão importadas como campos personalizados.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <Input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden" // Keep hidden, triggered by button
            />
            <Button variant="outline" onClick={triggerFileInput} className="w-full justify-start text-left">
              {file ? <FileText className="mr-2 h-5 w-5 text-primary" /> : <UploadCloud className="mr-2 h-5 w-5 text-muted-foreground" />}
              {file ? file.name : "Escolher arquivo CSV..."}
            </Button>
            {file && (
                 <p className="text-xs text-muted-foreground">Arquivo selecionado: {file.name}</p>
            )}
            <Button variant="ghost" onClick={handleDownloadModel} className="w-full justify-start text-left text-sm text-accent hover:text-accent/90">
                <Download className="mr-2 h-4 w-4" /> Baixar Modelo CSV (com exemplos)
            </Button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={() => { setFile(null); onOpenChange(false); }}>Cancelar</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleImportClick}
            disabled={!file || isParsing}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isParsing ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

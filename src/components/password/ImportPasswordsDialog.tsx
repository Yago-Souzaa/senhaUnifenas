
'use client';

import { useState, ChangeEvent } from 'react';
import type { PasswordEntry } from '@/types'; 
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
  onImport: (entries: Array<Omit<PasswordEntry, 'id'>>) => void; 
}

// Basic required fields for the system to work
const BASE_REQUIRED_HEADERS = ["nome", "login"]; 
// Common optional fields often included in templates
const COMMON_OPTIONAL_HEADERS = ["senha", "ip", "funcao", "acesso", "versao"];


export function ImportPasswordsDialog({ isOpen, onOpenChange, onImport }: ImportPasswordsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    } else {
      setFile(null);
    }
  };

  const parseCSV = (csvText: string): Array<Omit<PasswordEntry, 'id'>> => {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) { 
      throw new Error("CSV inválido ou vazio. Precisa de cabeçalho e pelo menos uma linha de dados.");
    }

    const headerLine = lines[0];
    const headersFromFile = (headerLine.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      ?.map(h => h.startsWith('"') && h.endsWith('"') ? h.slice(1, -1).replace(/""/g, '"').trim() : h.trim()) 
      || headerLine.split(',').map(h => h.trim()));
    
    const lowercasedHeadersFromFile = headersFromFile.map(h => h.toLowerCase());

    const missingRequiredHeaders = BASE_REQUIRED_HEADERS.filter(expected => !lowercasedHeadersFromFile.includes(expected));
    if (missingRequiredHeaders.length > 0) {
      throw new Error(`Cabeçalho do CSV inválido. Colunas obrigatórias ausentes: ${missingRequiredHeaders.join(', ')}. As colunas mínimas são: ${BASE_REQUIRED_HEADERS.join(', ')}.`);
    }
    
    const headerMap: { [key: string]: number } = {}; // Maps original header name to index
    headersFromFile.forEach((originalHeader, index) => {
        headerMap[originalHeader] = index; 
    });

    const entries: Array<Omit<PasswordEntry, 'id'>> = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
                             ?.map(v => v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/""/g, '"') : v.trim()) 
                             || lines[i].split(',').map(v => v.trim());

      let nome: string | undefined;
      let login: string | undefined;
      let senha: string | undefined;

      // Find 'nome' and 'login' values using case-insensitive matching for safety, but prefer direct match
      const nomeHeaderKey = Object.keys(headerMap).find(key => key.toLowerCase() === 'nome');
      const loginHeaderKey = Object.keys(headerMap).find(key => key.toLowerCase() === 'login');
      const senhaHeaderKey = Object.keys(headerMap).find(key => key.toLowerCase() === 'senha');

      if (nomeHeaderKey) nome = values[headerMap[nomeHeaderKey]];
      if (loginHeaderKey) login = values[headerMap[loginHeaderKey]];
      if (senhaHeaderKey) senha = values[headerMap[senhaHeaderKey]] || undefined;


      if (!nome || !login) { 
        console.warn(`Linha ${i+1} ignorada: Nome ou Login ausentes.`);
        continue;
      }

      const customFieldsToAdd: Array<{ label: string; value: string }> = [];
      headersFromFile.forEach((originalHeader, index) => {
        const lowerHeader = originalHeader.toLowerCase();
        if (!BASE_REQUIRED_HEADERS.includes(lowerHeader) && lowerHeader !== 'senha' && values[index] && values[index].trim() !== "") {
          customFieldsToAdd.push({ label: originalHeader, value: values[index] });
        }
      });

      entries.push({
        nome,
        login,
        senha,
        customFields: customFieldsToAdd,
      });
    }
    return entries;
  };

  const handleImportClick = async () => {
    if (!file) {
      toast({ title: "Nenhum arquivo selecionado", description: "Por favor, selecione um arquivo CSV.", variant: "destructive" });
      return;
    }

    setIsParsing(true);
    try {
      const fileText = await file.text();
      const parsedEntries = parseCSV(fileText);
      
      if (parsedEntries.length > 0) {
        onImport(parsedEntries); // Pass parsed entries to the handler in HomePage
        // Toasts for import success/failure are handled in HomePage's onImport handler
        onOpenChange(false); // Close dialog
        setFile(null); // Reset file input
      } else {
        toast({ title: "Nenhuma senha para importar", description: "O arquivo CSV não continha dados válidos ou todas as senhas já existem.", variant: "default" });
      }
    } catch (error: any) {
      console.error("Erro ao importar CSV:", error);
      toast({ title: "Erro na Importação", description: error.message || "Falha ao processar o arquivo CSV.", variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  };
  
  const triggerFileInput = () => {
    document.getElementById('csv-file-input')?.click();
  };

  const handleDownloadModel = () => {
    const exampleHeaders = [...BASE_REQUIRED_HEADERS, ...COMMON_OPTIONAL_HEADERS, "OutroCampoExemplo"];
    const csvHeader = exampleHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(','); // Ensure headers are quoted

    const exampleRowData = ["Minha App Web", "usuario@exemplo.com", "senhaSuperSegura123", "10.0.0.5", "Servidor de Testes", "HTTPS", "v1.2", "Valor do Outro Campo"];
    const exampleRow = exampleRowData.map(v => `"${v.replace(/"/g, '""')}"`).join(',');
    
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
            A coluna <code className="text-xs bg-muted p-1 rounded">senha</code> é opcional. <br />
            **Todas as outras colunas** no seu CSV (ex: ip, observacao, etc.) serão importadas como campos personalizados (o nome da coluna será o rótulo do campo).
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <Input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden" 
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
            <Button type="button" variant="outline">Cancelar</Button>
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


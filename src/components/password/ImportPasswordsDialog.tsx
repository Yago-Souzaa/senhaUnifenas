
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
  onImport: (entries: Array<Omit<PasswordEntry, 'id'>>) => Array<Omit<PasswordEntry, 'id'>>; 
}

const BASE_REQUIRED_HEADERS = ["nome", "login"]; 
// Colunas comuns, agora incluindo 'categoria'
const COMMON_OPTIONAL_HEADERS = ["senha", "categoria", "ip", "funcao", "acesso", "versao"];


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
    if (lines.length < 1) { // Pode ser só o cabeçalho, ou vazio
      throw new Error("CSV vazio ou contém apenas cabeçalho.");
    }
    if (lines.length < 2 && lines.length > 0) { // Só cabeçalho, sem dados
       console.warn("CSV contém apenas cabeçalho. Nenhuma senha para importar.");
       return [];
    }
    if (lines.length === 0) {
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
    
    const headerMap: { [key: string]: number } = {}; 
    headersFromFile.forEach((originalHeader, index) => {
        headerMap[originalHeader.toLowerCase()] = index; // Mapeia header em minúsculo para índice
    });

    const entries: Array<Omit<PasswordEntry, 'id'>> = [];
    for (let i = 1; i < lines.length; i++) { // Começa da segunda linha (dados)
      const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
                             ?.map(v => v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/""/g, '"') : v.trim()) 
                             || lines[i].split(',').map(v => v.trim());

      const entry: Partial<Omit<PasswordEntry, 'id'>> = {
        customFields: [],
      };

      // Campos principais
      entry.nome = values[headerMap['nome']];
      entry.login = values[headerMap['login']];
      if (typeof headerMap['senha'] !== 'undefined') {
        entry.senha = values[headerMap['senha']] || undefined;
      }
      if (typeof headerMap['categoria'] !== 'undefined') {
        entry.categoria = values[headerMap['categoria']] || undefined;
      }


      if (!entry.nome || !entry.login) { 
        console.warn(`Linha ${i+1} ignorada: Nome ou Login ausentes.`);
        continue;
      }

      // Campos personalizados (todas as outras colunas)
      headersFromFile.forEach((originalHeader, index) => {
        const lowerHeader = originalHeader.toLowerCase();
        // Adiciona como campo personalizado se não for um dos campos principais e tiver valor
        if (![...BASE_REQUIRED_HEADERS, 'senha', 'categoria'].includes(lowerHeader) && values[index] && values[index].trim() !== "") {
          entry.customFields?.push({ label: originalHeader, value: values[index] });
        }
      });

      entries.push(entry as Omit<PasswordEntry, 'id'>);
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
      
      const imported = onImport(parsedEntries); 
      if (imported.length > 0) {
           toast({ title: "Importação Concluída", description: `${imported.length} novas senhas importadas com sucesso.` });
      } else if (parsedEntries.length > 0 && imported.length === 0) {
           toast({ title: "Nenhuma Nova Senha", description: "Nenhuma senha nova foi importada. Podem ser duplicatas ou o arquivo não ter dados válidos além do cabeçalho.", variant: "default" });
      } else if (parsedEntries.length === 0) {
           // O parseCSV já pode ter lançado um erro ou retornado um array vazio com um console.warn
           // Se retornou array vazio e não houve erro, significa que não havia dados para importar
           toast({ title: "Nenhuma Senha Encontrada", description: "O arquivo CSV não continha dados válidos para importar além do cabeçalho.", variant: "default"});
      }
      onOpenChange(false); 
      setFile(null); 
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
    const exampleHeaders = [...BASE_REQUIRED_HEADERS, ...COMMON_OPTIONAL_HEADERS, "OutroCampoExemplo1", "OutroCampoExemplo2"];
    const csvHeader = exampleHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(',');

    const exampleRowData = ["App Exemplo", "user@example.com", "senha#123", "Servidores", "192.168.1.10", "Servidor Web", "HTTPS", "v2.1", "Valor Exemplo 1", "Outro Valor"];
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
            As colunas <code className="text-xs bg-muted p-1 rounded">senha</code> e <code className="text-xs bg-muted p-1 rounded">categoria</code> são opcionais mas recomendadas no modelo. <br />
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

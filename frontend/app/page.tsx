'use client';

import { useState, useEffect } from 'react';
import { Search, KeyRound, Layers, Download, FileJson, Loader2, CheckCircle2, AlertCircle, LayoutDashboard } from 'lucide-react';

// RENDERIZA A INTERFACE DE RECRUTAMENTO COM PROGRESS BAR
export default function RECRUITMENT_DASHBOARD() {
  const [url, setUrl] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [maxPages, setMaxPages] = useState<number>(2);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, text: '' });
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const [excelFile, setExcelFile] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('extraction_result');
    if (saved) {
      const { extractedData, excelFile, resultMessage } = JSON.parse(saved);
      setExtractedData(extractedData);
      setExcelFile(excelFile);
      setResultMessage(resultMessage);
    }
  }, []);

  // LEITURA DO FLUXO DE DADOS CONTINUO
  const HANDLE_EXTRACTION_SUBMIT = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResultMessage(null);
    setExtractedData([]);
    setExcelFile(null);
    setProgress({ percent: 0, text: 'conectando ao servidor...' });
    sessionStorage.removeItem('extraction_result'); // limpa cache da sessao anterior

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchUrl: url, liAtCookie: sessionToken, maxPages }),
      });

      if (!response.body) throw new Error('stream não suportado pelo navegador');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const cleanPart = part.trim();
          if (cleanPart) {
            try {
              const event = JSON.parse(cleanPart);
              
              if (event.type === 'progress') {
                setProgress({ percent: Math.round(event.percent), text: event.text });
              } else if (event.type === 'start') {
                setProgress({ percent: 0, text: event.text });
              } else if (event.type === 'complete') {
                setExtractedData(event.data);
                setExcelFile(event.excelBase64);
                setResultMessage({ type: 'success', text: `${event.data.length} talentos mapeados com sucesso!` });
                setProgress({ percent: 100, text: 'finalizado' });
                sessionStorage.setItem('extraction_result', JSON.stringify({
                  extractedData: event.data,
                  excelFile: event.excelBase64,
                  resultMessage: { type: 'success', text: `${event.data.length} talentos mapeados com sucesso!` }
                })); // persiste dados para navegacao
                setLoading(false);
              } else if (event.type === 'error') {
                setResultMessage({ type: 'error', text: event.text });
                setLoading(false);
              }
            } catch (err) {
              console.warn('chunk ignorado (provável heartbeat ou quebra)', cleanPart);
            }
          }
        }
      }
    } catch (error) {
      console.error('falha na comunicacao', error);
      setResultMessage({ type: 'error', text: 'conexão perdida com o servidor.' });
    } finally {
      setLoading(false);
    }
  };

  const DOWNLOAD_JSON = () => {
    const dataStr = JSON.stringify(extractedData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `talentos_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  const DOWNLOAD_EXCEL = () => {
    if (!excelFile) return;
    const link = document.createElement('a');
    link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${excelFile}`;
    link.download = `talentos_${new Date().getTime()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* TOPBAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-transparent p-1">
              <img src="/icon.png" alt="Logo" className="w-8 h-8 object-contain rounded" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Pipeline Recrutamento</h1>
              <p className="text-xs text-slate-500 font-medium">Motor de Extração PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/logs" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1.5">
              <FileJson className="w-4 h-4" />
              Ver Auditoria
            </a>
            <div className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
              Módulo: <span className="text-slate-700">LinkedIn Scraper</span>
            </div>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row gap-8">
        {/* PAINEL DE CONFIGURAÇÃO */}
        <div className="flex-1">
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-semibold text-slate-800">Parâmetros da Varredura</h2>
              <p className="text-sm text-slate-500 mt-1">Insira as credenciais e a URL de busca alvo.</p>
            </div>
            
            <div className="p-6">
              <form onSubmit={HANDLE_EXTRACTION_SUBMIT} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Token de Sessão (li_at)</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text" required value={sessionToken}
                      onChange={(e) => setSessionToken(e.target.value)}
                      placeholder="AQEDAS..."
                      className="block w-full rounded-lg border-slate-300 bg-slate-50 border py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">URL da Busca (LinkedIn)</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url" required value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/search/results/people/..."
                      className="block w-full rounded-lg border-slate-300 bg-slate-50 border py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Profundidade (Páginas)</label>
                  <div className="relative w-1/2">
                    <Layers className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number" min="1" max="10" required value={maxPages}
                      onChange={(e) => setMaxPages(Number(e.target.value))}
                      className="block w-full rounded-lg border-slate-300 bg-slate-50 border py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit" disabled={loading}
                    className={`w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold text-white transition-all duration-200 shadow-sm ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando Extração...
                      </>
                    ) : (
                      'Iniciar Varredura'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* PAINEL DE STATUS E RESULTADOS */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* BARRA DE PROGRESSO */}
          {loading && (
            <div className="bg-white shadow-sm rounded-xl border border-blue-100 p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                Status da Operação
              </h3>
              <div className="flex justify-between text-xs font-medium text-slate-600 mb-2">
                <span className="truncate pr-4">{progress.text}</span>
                <span className="whitespace-nowrap font-bold text-blue-600">{progress.percent}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out relative"
                  style={{ width: `${progress.percent}%` }}
                >
                  <div className="absolute top-0 bottom-0 left-0 right-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
            </div>
          )}

          {/* ÁREA DE RESULTADOS */}
          {resultMessage && !loading && (
            <div className={`p-6 rounded-xl border shadow-sm ${resultMessage.type === 'success' ? 'bg-white border-green-200' : 'bg-white border-red-200'}`}>
              <div className="flex items-start gap-3 mb-6">
                {resultMessage.type === 'success' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className={`text-base font-bold ${resultMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                    {resultMessage.type === 'success' ? 'Extração Concluída' : 'Falha na Operação'}
                  </h3>
                  <p className={`text-sm mt-1 ${resultMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                    {resultMessage.text}
                  </p>
                </div>
              </div>

              {resultMessage.type === 'success' && extractedData.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3 border-t border-slate-100 pt-5">
                  <button
                    onClick={DOWNLOAD_EXCEL}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 shadow-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Planilha (.xlsx)
                  </button>
                  <button
                    onClick={DOWNLOAD_JSON}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                  >
                    <FileJson className="w-4 h-4" />
                    Raw Data (JSON)
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* PLACEHOLDER QUANDO VAZIO */}
          {!loading && !resultMessage && (
            <div className="flex-1 bg-slate-50/50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-8 text-center min-h-50">
              <Layers className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">O motor de extração está ocioso.</p>
              <p className="text-xs text-slate-400 mt-1 max-w-62.5">Preencha os parâmetros e inicie a varredura para visualizar os resultados aqui.</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Search, FileText, LayoutDashboard, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function AUDIT_LOGS_DASHBOARD() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'ERROR' | 'INFO' | 'WARN'>('ALL');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/logs`);
        const data = await response.json();
        setLogs(data);
      } catch (err) {
        console.error('Falha ao obter logs', err);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // polling basico a cada 5s
    return () => clearInterval(interval);
  }, []);

  const handleClearLogs = async () => {
    if (!confirm('tem certeza que deseja apagar todos os registros de auditoria?')) return;
    try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/logs`, { method: 'DELETE' });
        setLogs([]);
    } catch (err) {
        console.error('falha ao limpar logs', err);
    }
 };

  const filteredLogs = logs.filter(log => filter === 'ALL' || log.level === filter);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-600 bg-red-50 border-red-200';
      case 'WARN': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR': return <AlertTriangle className="w-4 h-4" />;
      case 'WARN': return <Activity className="w-4 h-4" />;
      default: return <CheckCircle2 className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-transparent p-1">
              <img src="/icon.png" alt="Logo" className="w-8 h-8 object-contain rounded" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Auditoria e Governança</h1>
              <p className="text-xs text-slate-500 font-medium">Logs de Extração em Tempo Real</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleClearLogs} className="text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors px-4 py-2 rounded-md border border-red-200 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
                Limpar Logs
            </button>
            <Link href="/" className="text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors px-4 py-2 rounded-md border border-slate-200 flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Voltar ao Motor
            </Link>
            </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
          
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex gap-2">
              <button onClick={() => setFilter('ALL')} className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filter === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}>
                Todos
              </button>
              <button onClick={() => setFilter('INFO')} className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filter === 'INFO' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-200 hover:bg-green-50'}`}>
                Sucessos
              </button>
              <button onClick={() => setFilter('WARN')} className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filter === 'WARN' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'}`}>
                Avisos
              </button>
              <button onClick={() => setFilter('ERROR')} className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filter === 'ERROR' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200 hover:bg-red-50'}`}>
                Erros Críticos
              </button>
            </div>
            <div className="text-xs text-slate-400 font-medium flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Monitoramento Ativo
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase">
                <tr>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Timestamp</th>
                  <th className="px-6 py-4 font-semibold">Ação</th>
                  <th className="px-6 py-4 font-semibold">Detalhes (Metadados)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${getLevelColor(log.level)}`}>
                        {getLevelIcon(log.level)}
                        {log.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <pre className="text-[11px] bg-slate-100 p-2 rounded border border-slate-200 font-mono max-w-md overflow-x-auto">
                        {JSON.stringify(Object.fromEntries(Object.entries(log).filter(([k]) => !['timestamp', 'level', 'module', 'action'].includes(k))), null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      Nenhum registro encontrado para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
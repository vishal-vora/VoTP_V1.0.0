import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Table,
  Lock,
  Code2,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { getSqliteDatabaseSnapshot } from '../utils/storage';

interface SQLiteInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SQLiteInspectorModal: React.FC<SQLiteInspectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [snapshot, setSnapshot] = useState(getSqliteDatabaseSnapshot());
  const [selectedTableIndex, setSelectedTableIndex] = useState<number>(0);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSnapshot(getSqliteDatabaseSnapshot());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTable = snapshot.tables[selectedTableIndex] || snapshot.tables[0];

  const handleCopySchema = () => {
    if (!currentTable) return;
    navigator.clipboard.writeText(currentTable.schema);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      id="modal-sqlite-inspector"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-fadeIn"
    >
      <div className="w-full max-w-2xl bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-[#141418]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
              <Database className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-100">SQLite Storage Inspector</h2>
              <p className="text-[10px] text-zinc-400 font-mono">{snapshot.databasePath}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close database inspector"
            className="w-7 h-7 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
          {/* Table Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {snapshot.tables.map((tbl, idx) => (
              <button
                key={tbl.name}
                type="button"
                onClick={() => setSelectedTableIndex(idx)}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-medium whitespace-nowrap border transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedTableIndex === idx
                    ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-semibold shadow-xs'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Table className="w-3 h-3" />
                {tbl.name}
                <span className="text-[9px] bg-zinc-800/80 px-1 py-0.2 rounded-full">
                  {tbl.rowCount}
                </span>
              </button>
            ))}
          </div>

          {/* DDL Schema View */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1 text-zinc-400 font-semibold text-[10px]">
              <span className="flex items-center gap-1">
                <Code2 className="w-3 h-3 text-zinc-400" />
                DDL Table Schema
              </span>
              <button
                type="button"
                onClick={handleCopySchema}
                className="text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {isCopied ? 'Copied' : 'Copy SQL'}
              </button>
            </div>
            <pre className="font-mono text-[10px] text-zinc-300 overflow-x-auto whitespace-pre-wrap">
              {currentTable.schema}
            </pre>
          </div>

          {/* Data Records View */}
          <div>
            <div className="text-[11px] font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              Encrypted Rows ({currentTable.rows.length})
            </div>

            {currentTable.rows.length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-center text-zinc-400 font-mono text-[11px]">
                [TABLE EMPTY / NO ROWS PERSISTED]
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {currentTable.rows.map((row, rIdx) => (
                  <div
                    key={rIdx}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 font-mono text-[10px] space-y-0.5"
                  >
                    {Object.entries(row).map(([k, v]) => (
                      <div key={k} className="flex items-start gap-2">
                        <span className="text-zinc-400 shrink-0 w-28 font-semibold">{k}:</span>
                        <span className="text-zinc-200 break-all">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

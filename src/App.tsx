import React, { useState, useEffect, useRef } from "react";
import { Receipt, GoogleSheetsConfig } from "./types";
import { 
  Plus, 
  Check, 
  HelpCircle, 
  Upload, 
  FileText, 
  File, 
  Eye, 
  CheckSquare, 
  Square, 
  Trash2, 
  ChevronRight, 
  ArrowUpRight, 
  Settings, 
  History, 
  Database,
  RefreshCw
} from "lucide-react";
import { getAccessToken, initAuth } from "./lib/auth";
import { 
  createLedgerSpreadsheet, 
  initializeSheetHeaders, 
  syncReceiptToSheet, 
  verifySpreadsheetExists 
} from "./lib/sheets";
import ReceiptDetailsModal from "./components/ReceiptDetailsModal";
import ManualTokenInfo from "./components/ManualTokenInfo";

export default function App() {
  // State variables
  const [view, setView] = useState<"capture" | "mapping" | "history">("capture");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Spreadsheet integration states
  const [spreadsheetId, setSpreadsheetId] = useState<string>("");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>("");
  const [sheetName, setSheetName] = useState<string>("Sheet1");
  const [autoSync, setAutoSync] = useState<boolean>(false);
  const [sheetsFeedback, setSheetsFeedback] = useState<{ type: "success" | "error" | "info" | null; msg: string }>({ type: null, msg: "" });

  // Processing loader states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processStep, setProcessStep] = useState<string>("");
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Selector states
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);

  // File drag states
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // DOM Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load receipts, token, and sheet id from localStorage/session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("scripta_receipts_v2");
      if (stored) {
        setReceipts(JSON.parse(stored));
      } else {
        // Seed default beautiful mock items for initial layout aesthetic matching the design template
        const initialSeed: Receipt[] = [
          {
            id: "REC-1042",
            merchantName: "Blue Bottle Coffee",
            category: "Dining",
            date: "2026-06-01",
            totalAmount: 18.42,
            taxAmount: 1.52,
            items: [
              { name: "Single Origin Espresso", price: 4.75, quantity: 2 },
              { name: "Sourdough Avocado Toast", price: 11.50, quantity: 1 }
            ],
            status: "pending_sync",
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
          },
          {
            id: "REC-1420",
            merchantName: "Staples Business Depot",
            category: "Supplies",
            date: "2026-05-28",
            totalAmount: 142.09,
            taxAmount: 11.10,
            items: [
              { name: "Ergonomic Mesh Seat Support", price: 89.99, quantity: 1 },
              { name: "Recycled Bond Paper Ream", price: 14.50, quantity: 3 },
              { name: "Fine Liner Finetip Pens", price: 8.60, quantity: 1 }
            ],
            status: "pending_sync",
            timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
          },
          {
            id: "REC-0412",
            merchantName: "Delta Air Lines",
            category: "Travel",
            date: "2026-05-15",
            totalAmount: 412.50,
            taxAmount: 32.40,
            items: [
              { name: "Flight DL-2402 Economy Seat upgrade", price: 380.10, quantity: 1 }
            ],
            status: "synced",
            timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
            syncedAt: new Date(Date.now() - 3600000 * 47).toISOString()
          }
        ];
        setReceipts(initialSeed);
        localStorage.setItem("scripta_receipts_v2", JSON.stringify(initialSeed));
      }

      const storedSheetId = localStorage.getItem("scripta_sheet_id");
      const storedSheetUrl = localStorage.getItem("scripta_sheet_url");
      if (storedSheetId) setSpreadsheetId(storedSheetId);
      if (storedSheetUrl) setSpreadsheetUrl(storedSheetUrl);
    } catch (e) {
      console.error("Error retrieving initial cache", e);
    }

    // Check token
    initAuth(
      (userObj, testToken) => {
        setToken(testToken);
        setUser(userObj);
      },
      () => {
        setToken(null);
        setUser(null);
      }
    );
  }, []);

  // Update localStorage when receipts change
  const saveReceipts = (updated: Receipt[]) => {
    setReceipts(updated);
    try {
      localStorage.setItem("scripta_receipts_v2", JSON.stringify(updated));
    } catch (e) {
      console.error("Cache persistence error", e);
    }
  };

  // Keep track of connected Token
  const handleTokenUpdated = (newToken: string | null) => {
    setToken(newToken);
    if (!newToken) {
      setUser(null);
    } else {
      setUser({ displayName: "Google Sheet User" });
      setSheetsFeedback({ type: "success", msg: "Google Sheet connection recognized!" });
    }
  };

  // Google sheet configuration actions
  const handleCreateSheet = async () => {
    if (!token) {
      setSheetsFeedback({ type: "error", msg: "Please connect your Google Sheets account first using the form below." });
      return;
    }

    setSheetsFeedback({ type: "info", msg: "Requesting Drive to provision new Workbook..." });
    try {
      const info = await createLedgerSpreadsheet(token);
      setSpreadsheetId(info.id);
      setSpreadsheetUrl(info.url);
      localStorage.setItem("scripta_sheet_id", info.id);
      localStorage.setItem("scripta_sheet_url", info.url);

      // Add default headers row info
      setSheetsFeedback({ type: "info", msg: "Workbook created! Initializing ledger tables..." });
      await initializeSheetHeaders(info.id, token);

      setSheetsFeedback({ type: "success", msg: "Successfully created 'Scripta Receipt Ledger' in your Drive!" });
    } catch (err: any) {
      setSheetsFeedback({ type: "error", msg: err.message || "Failed to create spreadsheet." });
    }
  };

  const handleVerifySheet = async () => {
    if (!token) {
      setSheetsFeedback({ type: "error", msg: "Sheets token is verified as disconnected." });
      return;
    }
    if (!spreadsheetId) {
      setSheetsFeedback({ type: "error", msg: "Spreadsheet ID cannot be void." });
      return;
    }

    setSheetsFeedback({ type: "info", msg: "Verifying container spreadsheet access permissions..." });
    const exists = await verifySpreadsheetExists(spreadsheetId, token);
    if (exists) {
      setSheetsFeedback({ type: "success", msg: "Verification successful! Access confirmed." });
      localStorage.setItem("scripta_sheet_id", spreadsheetId);
      localStorage.setItem("scripta_sheet_url", `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
      setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
    } else {
      setSheetsFeedback({ type: "error", msg: "Access Forbidden or invalid Workbook ID." });
    }
  };

  // File input change handlers
  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  // Main file processing execution using fullstack /api/process-receipt model
  const processSelectedFile = (file: File) => {
    setIsProcessing(true);
    setProcessingError(null);
    setProcessStep("Analyzing graphic parameters...");

    // Convert file to Base64 data URL
    const reader = new FileReader();
    reader.onload = async () => {
      const base64String = reader.result as string;

      try {
        setProcessStep("Booting Gemini AI OCR Engine...");
        
        const response = await fetch("/api/process-receipt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image: base64String }),
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to process receipt image via backend scanner");
        }

        setProcessStep("Structuring tabular accounting fields...");
        const parsed: any = data.receipt;

        // Form unique ID tag
        const newId = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
        const newReceipt: Receipt = {
          id: newId,
          merchantName: parsed.merchantName || "Unknown Merchant",
          category: parsed.category || "Other",
          date: parsed.date || new Date().toISOString().split("T")[0],
          totalAmount: parseFloat(parsed.totalAmount) || 0,
          taxAmount: parseFloat(parsed.taxAmount) || 0,
          items: parsed.items || [],
          status: "pending_sync",
          timestamp: new Date().toISOString(),
          imageUrl: base64String, // cache image
        };

        const updatedQueue = [newReceipt, ...receipts];
        saveReceipts(updatedQueue);

        // Auto selection trigger
        setSelectedReceiptIds(prev => [...prev, newId]);

        setIsProcessing(false);
        setProcessStep("");
        
        // Auto-sync trigger
        if (autoSync && token && spreadsheetId) {
          syncSingleToSheetsDirectly(newReceipt);
        }
      } catch (err: any) {
        console.error("Scanning failed:", err);
        setProcessingError(err.message || "An unhandled error occurred during Gemini receipt parsing.");
        setIsProcessing(false);
        setProcessStep("");
      }
    };

    reader.onerror = () => {
      setProcessingError("File reading aborted or failed.");
      setIsProcessing(false);
      setProcessStep("");
    };

    reader.readAsDataURL(file);
  };

  // Detailed view & edits
  const handleSaveEditedReceipt = (updated: Receipt) => {
    const next = receipts.map((r) => (r.id === updated.id ? updated : r));
    saveReceipts(next);
    setSheetsFeedback({ type: "info", msg: `Updated details for ${updated.merchantName}.` });
  };

  // Receipt queue deletions
  const handleDeleteReceipt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm("Remove this entry from active local ledger database?");
    if (!confirmed) return;

    const next = receipts.filter((r) => r.id !== id);
    saveReceipts(next);
    setSelectedReceiptIds(prev => prev.filter(item => item !== id));
  };

  // Rows single sync action
  const syncSingleToSheetsDirectly = async (receipt: Receipt) => {
    if (!token) {
      alert("Missing workspace authorization. Use connection setup to authenticate Sheets.");
      return;
    }
    if (!spreadsheetId) {
      alert("Please initialize or bind a Google Spreadsheet Ledger ID before syncing!");
      return;
    }

    try {
      // Set temporary state to loading
      setSheetsFeedback({ type: "info", msg: `Syncing ${receipt.merchantName} to Sheet...` });
      
      await syncReceiptToSheet(spreadsheetId, receipt, token);

      const next = receipts.map((r) => {
        if (r.id === receipt.id) {
          return { ...r, status: "synced" as const, syncedAt: new Date().toISOString() };
        }
        return r;
      });
      saveReceipts(next);
      setSheetsFeedback({ type: "success", msg: `Successfully synced record: ${receipt.merchantName}.` });
    } catch (err: any) {
      alert(`Sync failures on ${receipt.merchantName}: ${err.message}`);
      const next = receipts.map((r) => {
        if (r.id === receipt.id) {
          return { ...r, status: "failed" as const };
        }
        return r;
      });
      saveReceipts(next);
    }
  };

  // Bulk Sheets Sync implementation
  const handleSyncSelectedToSheets = async () => {
    const toSync = receipts.filter(
      (r) => selectedReceiptIds.includes(r.id) && r.status !== "synced"
    );

    if (toSync.length === 0) {
      alert("Please select at least one pending receipt to sync!");
      return;
    }

    if (!token) {
      alert("Sheets account is disconnected. Authenticate using the connection panel.");
      return;
    }

    if (!spreadsheetId) {
      alert("Sheets ID void. Create a new Spreadsheet ledger first!");
      return;
    }

    const confirmSync = window.confirm(`Initiate synchronization of ${toSync.length} receipt records into Google Sheets?`);
    if (!confirmSync) return;

    setSheetsFeedback({ type: "info", msg: `Executing bulk ledger sync of ${toSync.length} items...` });

    let successCount = 0;
    let fallbackReceipts = [...receipts];

    for (const item of toSync) {
      try {
        await syncReceiptToSheet(spreadsheetId, item, token);
        fallbackReceipts = fallbackReceipts.map((r) => {
          if (r.id === item.id) {
            return { ...r, status: "synced" as const, syncedAt: new Date().toISOString() };
          }
          return r;
        });
        successCount++;
      } catch (err: any) {
        console.error(`Error syncing ${item.merchantName}:`, err);
        fallbackReceipts = fallbackReceipts.map((r) => {
          if (r.id === item.id) {
            return { ...r, status: "failed" as const };
          }
          return r;
        });
      }
    }

    saveReceipts(fallbackReceipts);
    setSelectedReceiptIds([]); // clear checkers
    setSheetsFeedback({ 
      type: successCount === toSync.length ? "success" : "info", 
      msg: `LEDGER BATCH SYNC COMPLETED: ${successCount} successful, ${toSync.length - successCount} failed.` 
    });
  };

  // Row selection checkbox helpers
  const toggleSelectReceipt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedReceiptIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const pendingIds = receipts.filter((r) => r.status !== "synced").map((r) => r.id);
    if (selectedReceiptIds.length === pendingIds.length) {
      setSelectedReceiptIds([]);
    } else {
      setSelectedReceiptIds(pendingIds);
    }
  };

  // Dynamic Ledger Computations
  const totalProcessedValue = receipts.reduce((sum, r) => sum + r.totalAmount, 0);
  const selectedUnprocessedSum = receipts
    .filter((r) => selectedReceiptIds.includes(r.id) && r.status !== "synced")
    .reduce((sum, r) => sum + r.totalAmount, 0);

  const displayPendingCount = receipts.filter((r) => r.status !== "synced").length;

  return (
    <div className="h-screen w-screen bg-[#F5F2ED] text-[#1A1A1A] flex overflow-hidden border-8 border-white box-border font-sans antialiased text-sm">
      {/* Hidden File Input for Trigger */}
      <input
        id="hidden-receipt-file-input"
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,application/pdf"
        className="hidden"
      />

      {/* Left Column: Navigation & Upload Control */}
      <div className="w-[380px] h-full border-r border-[#1A1A1A]/10 flex flex-col p-10 justify-between shrink-0 bg-[#FAF8F5]">
        <div className="space-y-12">
          {/* Header Title Branding */}
          <header className="select-none">
            <h1 className="text-5xl font-serif font-black tracking-tighter uppercase leading-none">SCRIPTA</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-mono mt-2 text-[#1a1a1a]/60">
              Intelligent Ledger Systems / v2.4
            </p>
          </header>

          {/* Navigation Links */}
          <nav className="space-y-4">
            <div 
              id="nav-capture-btn"
              onClick={() => setView("capture")}
              className={`group cursor-pointer border-b pb-4 flex items-center justify-between transition-all duration-300 ${
                view === "capture" ? "border-[#1A1A1A] font-bold" : "border-[#1A1A1A]/5 opacity-40 hover:opacity-80"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono opacity-50">01</span>
                <span className="text-lg font-serif italic">Capture Archive</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${view === "capture" ? "translate-x-1" : "opacity-0"}`} />
            </div>

            <div 
              id="nav-mapping-btn"
              onClick={() => setView("mapping")}
              className={`group cursor-pointer border-b pb-4 flex items-center justify-between transition-all duration-300 ${
                view === "mapping" ? "border-[#1A1A1A] font-bold" : "border-[#1A1A1A]/5 opacity-40 hover:opacity-80"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono opacity-50">02</span>
                <span className="text-lg font-serif italic">Sheet Settings</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${view === "mapping" ? "translate-x-1" : "opacity-0"}`} />
            </div>

            <div 
              id="nav-history-btn"
              onClick={() => setView("history")}
              className={`group cursor-pointer border-b pb-4 flex items-center justify-between transition-all duration-300 ${
                view === "history" ? "border-[#1A1A1A] font-bold" : "border-[#1A1A1A]/5 opacity-40 hover:opacity-80"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono opacity-50">03</span>
                <span className="text-lg font-serif italic">Audit History</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${view === "history" ? "translate-x-1" : "opacity-0"}`} />
            </div>
          </nav>
        </div>

        {/* Upload Zone & Sheets Status */}
        <div className="space-y-6">
          {view === "capture" && (
            <div 
              id="receipt-drop-zone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`bg-white border-2 border-dashed rounded-tr-[40px] p-8 shadow-xs text-center transition-all duration-300 select-none ${
                isDraggingFile ? "border-[#1A1A1A] bg-[#F5F2ED]" : "border-[#1A1A1A]/15 hover:border-[#1A1A1A]/30"
              }`}
            >
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 border border-[#1A1A1A]/10 rounded-full flex items-center justify-center bg-[#F5F2ED]">
                  <Upload className="w-5 h-5 text-[#1A1A1A]/70" />
                </div>
              </div>
              <button 
                id="upload-receipt-trigger"
                onClick={handleBrowseFiles}
                className="w-full py-3.5 bg-[#1A1A1A] text-white text-[10px] font-mono font-bold tracking-widest uppercase rounded-sm hover:bg-black transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                Scan Receipt
              </button>
              <p className="text-[10px] italic mt-3 text-[#1A1A1A]/50">
                Drag & drop or Click to browse (PNG, JPG, PDF)
              </p>
            </div>
          )}

          {/* Integrated Sheets Account Indicators */}
          <div className="border-t border-[#1A1A1A]/15 pt-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${token ? "bg-green-500 animate-pulse" : "bg-amber-400"}`}></div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1a1a1a]/80">
                {token ? "Google Workspaces Online" : "Sandbox Sheets Authorization Offline"}
              </span>
            </div>
            
            {/* Quick Spreadsheet quick stats in footer */}
            {spreadsheetId && (
              <div className="flex items-center justify-between text-[11px] font-mono opacity-60">
                <span>Active Sheet:</span>
                <a 
                  id="active-sheet-link-sidebar"
                  href={spreadsheetUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1 hover:text-[#1A1A1A] hover:underline"
                >
                  {spreadsheetId.substring(0, 8)}...<ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Dynamic Content Panel & Ledger Queue */}
      <div className="flex-1 h-full flex flex-col bg-[#F5F2ED]">
        {/* Dynamic Header */}
        <div className="p-12 pb-8 border-b border-[#1A1A1A]/10 flex justify-between items-end shrink-0">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#1a1a1a]/50">Accounting log book</span>
            <h2 className="text-5xl font-serif italic mt-2">
              {view === "capture" && "The Queue"}
              {view === "mapping" && "Spreadsheet Link"}
              {view === "history" && "Audit Archive"}
            </h2>
          </div>

          <div className="text-right">
            {view === "capture" && (
              <>
                <span id="pending-items-badge" className="block text-4xl font-serif font-light leading-none">{displayPendingCount}</span>
                <span className="text-[9px] uppercase font-mono tracking-wider font-bold opacity-50">Pending Sync</span>
              </>
            )}
            {view === "mapping" && (
              <span className="px-3 py-1 border border-[#1A1A1A]/25 rounded-full text-[10px] font-mono font-bold uppercase">
                Sheets Protocol v4
              </span>
            )}
            {view === "history" && (
              <>
                <span id="synced-items-badge" className="block text-4xl font-serif font-light leading-none">
                  {receipts.filter(r => r.status === "synced").length}
                </span>
                <span className="text-[9px] uppercase font-mono tracking-wider font-bold opacity-50">Total Synced Logs</span>
              </>
            )}
          </div>
        </div>

        {/* Global Feedback Panel */}
        {sheetsFeedback.type && (
          <div className={`px-12 py-3 border-b flex justify-between items-center text-xs font-mono select-none ${
            sheetsFeedback.type === "success" ? "bg-green-50 text-green-800 border-green-100" :
            sheetsFeedback.type === "error" ? "bg-red-50 text-red-800 border-red-100" :
            "bg-[#1A1A1A]/5 text-[#1A1A1A]/80 border-[#1A1A1A]/10"
          }`}>
            <span>{sheetsFeedback.msg}</span>
            <button 
              onClick={() => setSheetsFeedback({ type: null, msg: "" })} 
              className="hover:scale-115 transition-transform"
            >
              [close]
            </button>
          </div>
        )}

        {/* Dynamic content view renderer */}
        <div className="flex-1 p-12 overflow-y-auto">
          
          {/* Loader Overlay for Processing */}
          {isProcessing && (
            <div className="bg-white border border-[#1A1A1A]/10 p-12 text-center rounded-sm space-y-6 max-w-md mx-auto my-12 shadow-sm animate-fade-in font-sans">
              <div className="relative w-12 h-12 mx-auto flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-[#1A1A1A] animate-spin" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-serif italic text-[#1A1A1A]">Processing Receipt</p>
                <p className="text-xs font-mono text-[#1A1A1A]/50 tracking-wider uppercase animate-pulse">{processStep}</p>
              </div>
              <p className="text-xs text-[#1A1A1A]/60 leading-relaxed font-serif">
                Using Gemini 3.5 Flash to automatically detect merchant signatures, dates, line items, and taxes.
              </p>
            </div>
          )}

          {/* Render error if parsing fails */}
          {processingError && (
            <div className="bg-red-50 border border-red-200 text-red-900 p-8 rounded-sm max-w-lg mx-auto my-8 space-y-4 font-sans">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm uppercase">OCR Engine Blocked</span>
              </div>
              <p className="text-xs font-mono">{processingError}</p>
              <div className="pt-2">
                <button 
                  onClick={() => setProcessingError(null)}
                  className="px-4 py-2 border border-red-300 text-xs font-bold uppercase rounded-sm hover:bg-white transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* VIEW: CAPTURE QUEUE */}
          {!isProcessing && !processingError && view === "capture" && (
            <div className="space-y-8">
              {receipts.filter(r => r.status !== "synced").length === 0 ? (
                <div className="text-center py-24 select-none">
                  <div className="max-w-xs mx-auto space-y-4">
                    <p className="text-2xl font-serif italic">Queue Is Completely Clear</p>
                    <p className="text-[#1A1A1A]/50 text-xs leading-relaxed font-mono uppercase tracking-wider">
                      Please upload a receipt statement in the side controller to process entries.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Select controls above table */}
                  <div className="flex justify-between items-center pb-2 border-b border-[#1A1A1A]/10 text-xs font-mono select-none">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 hover:text-[#1A1A1A]/80 transition-colors"
                      >
                        {selectedReceiptIds.length === receipts.filter(r => r.status !== "synced").length ? (
                          <CheckSquare className="w-4 h-4 text-[#1A1A1A]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#1A1A1A]/60" />
                        )}
                        <span>Select All Pending</span>
                      </button>
                      <span className="text-[#1A1A1A]/40">|</span>
                      <span className="text-[#1A1A1A]/60">{selectedReceiptIds.length} checked</span>
                    </div>

                    <span className="text-[10px] uppercase opacity-40">Click row item to review products</span>
                  </div>

                  {/* Main Table layout */}
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#1A1A1A]/20">
                        <th className="py-4 w-12 text-center text-[10px] uppercase font-mono tracking-wider opacity-40">Choose</th>
                        <th className="py-4 text-[10px] uppercase font-mono tracking-wider opacity-40">Merchant Name</th>
                        <th className="py-4 text-[10px] uppercase font-mono tracking-wider opacity-40">Category</th>
                        <th className="py-4 text-[10px] uppercase font-mono tracking-wider opacity-40">Transaction Date</th>
                        <th className="py-4 text-[10px] uppercase font-mono tracking-wider text-right opacity-40">Amount</th>
                        <th className="py-4 text-[10px] uppercase font-mono tracking-wider text-center opacity-40">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {receipts
                        .filter((r) => r.status !== "synced")
                        .map((receipt) => (
                          <tr 
                            key={receipt.id}
                            onClick={() => setActiveReceipt(receipt)}
                            className="border-b border-[#1A1A1A]/5 hover:bg-white/40 cursor-pointer transition-all group"
                          >
                            <td className="py-5 text-center" onClick={(e) => toggleSelectReceipt(receipt.id, e)}>
                              <button className="p-1 hover:bg-[#1A1A1A]/5 rounded-sm transition-colors mx-auto block">
                                {selectedReceiptIds.includes(receipt.id) ? (
                                  <CheckSquare className="w-4 h-4 text-[#1A1A1A]" />
                                ) : (
                                  <Square className="w-4 h-4 text-[#1A1A1A]/40" />
                                )}
                              </button>
                            </td>
                            <td className="py-5 font-serif text-lg tracking-tight text-[#1A1A1A]">
                              {receipt.merchantName}
                            </td>
                            <td className="py-5">
                              <span className="border border-[#1A1A1A]/20 px-2.5 py-1 rounded-full text-[9px] uppercase font-bold text-[#1A1A1A]/70">
                                {receipt.category}
                              </span>
                            </td>
                            <td className="py-5 opacity-60 font-mono text-[11px]">
                              {new Date(receipt.date).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "2-digit",
                              })}
                            </td>
                            <td className="py-5 text-right font-serif font-bold text-[15px]">
                              ${receipt.totalAmount.toFixed(2)}
                            </td>
                            <td className="py-5 text-center flex items-center justify-center gap-2">
                              {token && spreadsheetId && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    syncSingleToSheetsDirectly(receipt);
                                  }}
                                  className="px-2.5 py-1 bg-[#1A1A1A] text-white text-[9px] uppercase font-mono rounded-sm hover:bg-black transition-colors"
                                  title="Sync single receipt instantly"
                                >
                                  Sync
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleDeleteReceipt(receipt.id, e)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded-sm hover:scale-105 transition-all"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW: CONNECTIONS & SPREADSHEEET MAPPING */}
          {view === "mapping" && (
            <div className="max-w-2xl space-y-12 animate-fade-in font-sans">
              <div className="space-y-4">
                <h3 className="text-xl font-serif italic border-b border-[#1A1A1A]/10 pb-2">1. Google Spreadsheet Connection</h3>
                <p className="text-xs text-[#1A1A1A]/60 leading-relaxed font-serif">
                  Initialize sheets parameters below. You can either automatically spawn a highly structured Ledger sheet, or bind an existing Google Spreadsheet ID where you want transaction logs recorded.
                </p>

                {/* Spreadsheet ID Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-white border border-[#1A1A1A]/10 p-6 rounded-sm">
                  <div className="md:col-span-2">
                    <label className="block text-[9px] uppercase tracking-wider text-[#1A1A1A]/60 font-bold mb-2">Google Spreadsheet ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 1xR-p0r_9fK..."
                      value={spreadsheetId}
                      onChange={(e) => setSpreadsheetId(e.target.value)}
                      className="w-full px-3 py-2 border border-[#1A1A1A]/15 bg-[#FAF8F5] rounded-sm text-xs focus:outline-none focus:border-[#1A1A1A] font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      id="save-sheet-id-btn"
                      onClick={handleVerifySheet}
                      className="flex-1 py-2 border border-[#1A1A1A] text-xs uppercase tracking-wider font-bold rounded-sm text-[#1A1A1A] bg-white hover:bg-[#F5F2ED] transition-colors"
                    >
                      Bind & Verify
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <button
                    id="create-new-ledger-sheet-btn"
                    onClick={handleCreateSheet}
                    className="px-6 py-3 bg-[#1A1A1A] text-white text-[10px] font-mono font-bold tracking-widest uppercase rounded-sm hover:bg-black transition-colors"
                  >
                    Spawn New Ledger Sheet
                  </button>

                  {spreadsheetUrl && (
                    <a
                      id="open-gspreadsheet-btn"
                      href={spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-mono text-[#1a1a1a] hover:underline"
                    >
                      Open active Spreadsheet <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Automation Rules */}
              <div className="space-y-4">
                <h3 className="text-xl font-serif italic border-b border-[#1A1A1A]/10 pb-2">2. Ledger Sync Automation</h3>
                <div className="bg-[#FAF8F5] border border-[#1A1A1A]/10 p-6 rounded-sm space-y-4 select-none">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-bold font-mono uppercase tracking-wider text-[#1A1A1A]">Instant Synch Mode</span>
                      <span className="text-[11px] text-[#1A1A1A]/50">Process and immediately push entries to Sheets without checking the queue.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={autoSync}
                        onChange={(e) => setAutoSync(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-[#1a1a1a]/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-[#1A1A1A] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Developer credentials setup */}
              <div className="space-y-4">
                <h3 className="text-xl font-serif italic border-b border-[#1A1A1A]/10 pb-2">3. Google Access Credentials</h3>
                <p className="text-xs text-[#1A1A1A]/60 leading-relaxed font-serif">
                  Paste a temporary Google API access token here to authenticate your local sandbox session. Connects your browser direct to Sheets client nodes.
                </p>
                <ManualTokenInfo 
                  currentToken={token} 
                  onTokenUpdated={handleTokenUpdated} 
                />
              </div>
            </div>
          )}

          {/* VIEW: AUDIT ARCHIVE (Synced items history logs) */}
          {view === "history" && (
            <div className="space-y-6">
              {receipts.filter(r => r.status === "synced").length === 0 ? (
                <div className="text-center py-24 select-none">
                  <p className="text-2xl font-serif italic mb-2">No Records Archive Found</p>
                  <p className="text-[#1A1A1A]/50 text-xs font-mono uppercase tracking-wider">Empty sync logs.</p>
                </div>
              ) : (
                <div className="border border-[#1A1A1A]/10 rounded-sm bg-white p-6 space-y-4">
                  <div className="flex justify-between items-center text-xs font-mono pb-2 border-b border-[#1A1A1A]/10 select-none text-[#1A1A1A]/60">
                    <span className="uppercase">Ledger transaction database</span>
                    <span>Synced Ledger list count: {receipts.filter(r => r.status === "synced").length}</span>
                  </div>

                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#1A1A1A]/20">
                        <th className="py-4 text-[10px] uppercase font-mono tracking-wider opacity-40">Merchant</th>
                        <th className="py-4 text-[10px] uppercase font-mono tracking-wider opacity-40">Category</th>
                        <th className="py-4 text-[10px] uppercase font-mono tracking-wider opacity-40">Date</th>
                        <th className="py-4 text-[10px] uppercase font-mono tracking-wider opacity-40">Tax Amount</th>
                        <th className="py-4 text-[10px] uppercase font-mono tracking-wider text-right opacity-40">Synced Sum</th>
                        <th className="py-4 text-[10px] uppercase font-mono tracking-wider text-right opacity-40">Sync Date</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {receipts
                        .filter((r) => r.status === "synced")
                        .map((receipt) => (
                          <tr key={receipt.id} className="border-b border-[#1A1A1A]/5 hover:bg-slate-50/50 transition-all">
                            <td className="py-5 font-serif text-lg tracking-tight text-[#1A1A1A]">
                              {receipt.merchantName}
                            </td>
                            <td className="py-5">
                              <span className="border border-green-200 bg-green-50 text-green-800 px-2.5 py-1 rounded-full text-[9px] uppercase font-bold">
                                {receipt.category}
                              </span>
                            </td>
                            <td className="py-5 opacity-60 font-mono text-[11px]">{receipt.date}</td>
                            <td className="py-5 font-mono opacity-60">${(receipt.taxAmount || 0).toFixed(2)}</td>
                            <td className="py-5 text-right font-serif font-bold text-[15px] text-green-800">
                              ${receipt.totalAmount.toFixed(2)}
                            </td>
                            <td className="py-5 text-right font-mono text-[10px] opacity-50">
                              {receipt.syncedAt ? new Date(receipt.syncedAt).toLocaleTimeString() : "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Bottom Action Bar: Dynamic stats & syncing control */}
        <div className="h-28 bg-[#1A1A1A] text-white flex items-center px-12 justify-between shrink-0 font-sans shadow-lg">
          <div className="flex gap-12 select-none">
            <div>
              <span className="block text-[9px] uppercase tracking-widest text-[#FFF]/50">Total Processed Vol</span>
              <span id="total-processed-calc" className="font-serif text-2xl font-bold tracking-tight">${totalProcessedValue.toFixed(2)}</span>
            </div>
            
            <div className="w-[1px] h-12 bg-white/20 self-center"></div>

            <div>
              <span className="block text-[9px] uppercase tracking-widest text-green-200/60">Checked to Sync ({receipts.filter(r => selectedReceiptIds.includes(r.id)).length})</span>
              <span id="unprocessed-sync-calc" className="font-serif text-2xl font-bold text-green-300">${selectedUnprocessedSum.toFixed(2)}</span>
            </div>

            <div className="w-[1px] h-12 bg-white/20 self-center"></div>

            <div>
              <span className="block text-[9px] uppercase tracking-widest text-[#FFF]/50">Ledger Sheets Bind</span>
              {spreadsheetId ? (
                <a 
                  id="active-sheet-link-footer"
                  href={spreadsheetUrl} 
                  target="_blank"  
                  rel="noopener noreferrer"
                  className="font-mono text-xs hover:underline text-green-300 flex items-center gap-1 mt-1 font-bold"
                >
                  Spreadsheet Linked <ArrowUpRight className="w-3 h-3" />
                </a>
              ) : (
                <span className="font-mono text-[11px] text-amber-300 block mt-1 font-bold">Unmapped Ledger File</span>
              )}
            </div>
          </div>

          <button
            id="sync-ledger-sheets-trigger"
            onClick={handleSyncSelectedToSheets}
            disabled={selectedReceiptIds.length === 0}
            className={`px-10 py-4.5 rounded-sm text-xs font-bold uppercase tracking-widest border transition-all cursor-pointer ${
              selectedReceiptIds.length > 0
                ? "bg-white text-[#1A1A1A] border-white hover:bg-[#F5F2ED] shadow-md hover:scale-[1.02]"
                : "text-white/30 border-white/10 cursor-not-allowed uppercase"
            }`}
          >
            Sync Selected to Sheets
          </button>
        </div>
      </div>

      {/* Itemized Audit Check statement Modal */}
      {activeReceipt && (
        <ReceiptDetailsModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
          onSave={handleSaveEditedReceipt}
        />
      )}
    </div>
  );
}

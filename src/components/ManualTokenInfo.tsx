import React, { useState } from "react";
import { setManualSandboxToken, clearManualSandboxToken } from "../lib/auth";
import { Key, Check, HelpCircle, RefreshCw, LogOut } from "lucide-react";

interface Props {
  onTokenUpdated: (token: string | null) => void;
  currentToken: string | null;
}

export default function ManualTokenInfo({ onTokenUpdated, currentToken }: Props) {
  const [inputText, setInputText] = useState(currentToken || "");
  const [showInstructions, setShowInstructions] = useState(false);

  const handleSave = () => {
    if (!inputText.trim()) {
      clearManualSandboxToken();
      onTokenUpdated(null);
    } else {
      const sanitized = inputText.trim();
      setManualSandboxToken(sanitized);
      onTokenUpdated(sanitized);
    }
  };

  const handleDisconnect = () => {
    clearManualSandboxToken();
    setInputText("");
    onTokenUpdated(null);
  };

  return (
    <div className="bg-white border border-[#1A1A1A]/10 p-6 rounded-tr-[40px] shadow-sm font-sans space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] uppercase tracking-widest text-[#1A1A1A]/60 font-bold">
          Sheets Connection
        </label>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-[#1A1A1A]/50 hover:text-[#1A1A1A] transition-colors"
          title="How to get credentials"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {showInstructions && (
        <div className="text-[11px] text-[#1a1a1a]/70 bg-[#F5F2ED] p-3 rounded-sm space-y-2 leading-relaxed border-l-2 border-[#1A1A1A]">
          <p className="font-bold">To connect your real Google Sheets:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1A1A1A]">Google OAuth Playground</a></li>
            <li>Select <strong>Google Sheets API v4</strong> under step 1</li>
            <li>Authorize with scope <code>.../auth/spreadsheets</code></li>
            <li>Click <strong>Exchange authorization code for tokens</strong></li>
            <li>Copy the <strong>Access Token</strong> value & paste it below!</li>
          </ol>
        </div>
      )}

      {currentToken ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2 bg-green-50 text-green-800 border border-green-200 rounded-sm text-xs select-none">
            <Check className="w-4 h-4 text-green-600 shrink-0" />
            <span className="truncate font-mono">Authenticated Sandbox Token</span>
          </div>
          <button
            id="disconnect-sheets-btn"
            onClick={handleDisconnect}
            className="w-full py-2.5 border border-red-200 text-red-700 text-[10px] font-bold tracking-widest uppercase rounded-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Disconnect Sheets
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Key className="w-3.5 h-3.5 absolute left-3 top-3 opacity-40 text-[#1a1a1a]" />
            <input
              id="google-token-input"
              type="password"
              placeholder="Paste Google Access Token..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-[#1A1A1A]/15 bg-white rounded-sm text-xs focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>
          <button
            id="connect-sheets-btn"
            onClick={handleSave}
            className="w-full py-3 bg-[#1A1A1A] text-white text-[11px] font-bold tracking-widest uppercase rounded-sm hover:bg-black transition-colors"
          >
            Verify & Connect
          </button>
        </div>
      )}
    </div>
  );
}

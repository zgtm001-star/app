import React, { useState } from "react";
import { Receipt, ReceiptItem } from "../types";
import { X, Calendar, DollarSign, Tag, Store, Plus, Trash2, Check } from "lucide-react";

interface Props {
  receipt: Receipt;
  onClose: () => void;
  onSave: (updated: Receipt) => void;
}

export default function ReceiptDetailsModal({ receipt, onClose, onSave }: Props) {
  const [merchantName, setMerchantName] = useState(receipt.merchantName);
  const [category, setCategory] = useState(receipt.category);
  const [date, setDate] = useState(receipt.date);
  const [totalAmount, setTotalAmount] = useState(receipt.totalAmount);
  const [taxAmount, setTaxAmount] = useState(receipt.taxAmount || 0);
  const [items, setItems] = useState<ReceiptItem[]>(receipt.items || []);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState(0);
  const [newItemQty, setNewItemQty] = useState(1);

  const categories = ["Dining", "Travel", "Supplies", "Utilities", "Rent", "Subscriptions", "Entertainment", "Other"];

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || newItemPrice <= 0) return;
    const item: ReceiptItem = {
      name: newItemName,
      price: newItemPrice,
      quantity: newItemQty,
    };
    const updatedItems = [...items, item];
    setItems(updatedItems);
    
    // Auto-calculate new total/tax sum
    const subtotal = updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    setTotalAmount(parseFloat((subtotal + Number(taxAmount)).toFixed(2)));

    // Reset inputs
    setNewItemName("");
    setNewItemPrice(0);
    setNewItemQty(1);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    const subtotal = updated.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    setTotalAmount(parseFloat((subtotal + Number(taxAmount)).toFixed(2)));
  };

  const handleSave = () => {
    onSave({
      ...receipt,
      merchantName,
      category,
      date,
      totalAmount: Number(totalAmount),
      taxAmount: Number(taxAmount),
      items,
    });
    onClose();
  };

  return (
    <div id="receipt-details-backdrop" className="fixed inset-0 bg-[#1a1a1a]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-[#FAF8F5] border border-[#1A1A1A]/20 max-w-2xl w-full rounded-md shadow-xl overflow-hidden max-h-[90vh] flex flex-col font-sans">
        {/* Header */}
        <div className="p-6 border-b border-[#1A1A1A]/10 flex justify-between items-start">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#1a1a1a]/50">Audit ledger / check</span>
            <h2 className="text-3xl font-serif italic mt-1">Review Statement</h2>
          </div>
          <button id="close-modal-btn" onClick={onClose} className="p-2 hover:bg-[#1A1A1A]/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-[#1A1A1A]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Main Info Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#1A1A1A]/60 font-bold mb-2">Merchant</label>
              <div className="relative">
                <Store className="w-4 h-4 absolute left-3 top-3 opacity-40 text-[#1a1a1a]" />
                <input
                  type="text"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-[#1A1A1A]/15 bg-white rounded-sm text-sm focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#1A1A1A]/60 font-bold mb-2">Category</label>
              <div className="relative">
                <Tag className="w-4 h-4 absolute left-3 top-3 opacity-40 text-[#1a1a1a]" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-[#1A1A1A]/15 bg-white rounded-sm text-sm focus:outline-none focus:border-[#1A1A1A]"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#1A1A1A]/60 font-bold mb-2">Transaction Date</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-3 opacity-40 text-[#1a1a1a]" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-[#1A1A1A]/15 bg-white rounded-sm text-sm focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#1A1A1A]/60 font-bold mb-2">Tax Amount</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-3 opacity-40 text-[#1a1a1a]" />
                <input
                  type="number"
                  step="0.01"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-2 border border-[#1A1A1A]/15 bg-white rounded-sm text-sm focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>
            </div>
          </div>

          {/* Itemized list */}
          <div>
            <h3 className="text-xs uppercase font-bold tracking-wider text-[#1A1A1A]/50 mb-4 border-b border-[#1A1A1A]/10 pb-2">
              Itemized Summations
            </h3>

            {items.length === 0 ? (
              <p className="text-xs italic text-[#1A1A1A]/40 my-4 text-center">No individual line items parsed. Add some below.</p>
            ) : (
              <div className="border border-[#1A1A1A]/10 rounded-sm overflow-hidden mb-6">
                <table className="w-full text-left text-xs bg-white">
                  <thead>
                    <tr className="bg-[#1A1A1A]/5 border-b border-[#1A1A1A]/10 text-[10px] uppercase font-bold tracking-widest opacity-60">
                      <th className="p-3">Product / description</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b border-[#1A1A1A]/5 last:border-0 hover:bg-[#F5F2ED]/30">
                        <td className="p-3 font-serif font-medium">{item.name}</td>
                        <td className="p-3 text-right font-mono text-xs">${item.price.toFixed(2)}</td>
                        <td className="p-3 text-center font-mono text-xs">{item.quantity}</td>
                        <td className="p-3 text-right font-mono text-xs">
                          ${(item.price * item.quantity).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-sm transition-colors"
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

            {/* Form to add item */}
            <form onSubmit={handleAddItem} className="bg-[#1A1A1A]/5 p-4 rounded-sm border border-[#1A1A1A]/10 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-[9px] uppercase tracking-wider text-[#1A1A1A]/60 font-bold mb-1">New Item Description</label>
                <input
                  type="text"
                  placeholder="e.g. Filter Coffee Beans"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#1A1A1A]/15 bg-white rounded-sm text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-[#1A1A1A]/60 font-bold mb-1">Unit Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newItemPrice || ""}
                  onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-[#1A1A1A]/15 bg-white rounded-sm text-xs focus:outline-none focus:border-[#1A1A1A] font-mono"
                />
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="block text-[9px] uppercase tracking-wider text-[#1A1A1A]/60 font-bold mb-1">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 border border-[#1A1A1A]/15 bg-white rounded-sm text-xs focus:outline-none focus:border-[#1A1A1A] font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="h-8 px-3 bg-[#1A1A1A] text-white rounded-sm flex items-center justify-center hover:bg-[#333] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#1A1A1A]/5 border-t border-[#1A1A1A]/15 flex items-center justify-between">
          <div className="flex gap-4">
            <div>
              <span className="block text-[9px] uppercase tracking-wider text-[#1A1A1A]/50">Subtotal + Tax Included</span>
              <span className="text-xl font-serif font-bold text-[#1A1A1A] font-mono">${totalAmount.toFixed(2)}</span>
            </div>
          </div>
          <button
            id="save-statement-btn"
            onClick={handleSave}
            className="px-6 py-3 bg-[#1A1A1A] text-white text-xs font-bold tracking-widest uppercase rounded-sm hover:bg-[#333] transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

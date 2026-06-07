import { Receipt } from "../types";

/**
 * Creates a new Google Spreadsheet with the title "Scripta Receipt Ledger"
 */
export async function createLedgerSpreadsheet(token: string): Promise<{ id: string; url: string }> {
  const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: "Scripta Receipt Ledger - " + new Date().toLocaleDateString(),
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || "Failed to create Google Spreadsheet");
  }

  const data = await response.json();
  return {
    id: data.spreadsheetId,
    url: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
  };
}

/**
 * Initializes the headers in the Spreadsheet if not already present
 */
export async function initializeSheetHeaders(spreadsheetId: string, token: string): Promise<void> {
  const range = "Sheet1!A1:H1";
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values: [
          [
            "Receipt ID",
            "Merchant Name",
            "Category",
            "Transaction Date",
            "Total Amount",
            "Tax Amount",
            "Line Items Summary",
            "Synced At",
          ],
        ],
      }),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || "Failed to initialize spreadsheet headers");
  }
}

/**
 * Appends a receipt record into the Google Sheet
 */
export async function syncReceiptToSheet(spreadsheetId: string, receipt: Receipt, token: string): Promise<void> {
  const itemsSummary = receipt.items
    ?.map((item) => `${item.name} (x${item.quantity || 1}): $${item.price.toFixed(2)}`)
    .join("; ") || "No items listed";

  const range = "Sheet1!A1";
  const rowValue = [
    receipt.id,
    receipt.merchantName,
    receipt.category,
    receipt.date,
    receipt.totalAmount,
    receipt.taxAmount || 0,
    itemsSummary,
    new Date().toISOString(),
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values: [rowValue],
      }),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to sync receipt to Google Sheet: ${receipt.merchantName}`);
  }
}

/**
 * Verifies if the spreadsheet is accessible
 */
export async function verifySpreadsheetExists(spreadsheetId: string, token: string): Promise<boolean> {
  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.ok;
  } catch (err) {
    return false;
  }
}

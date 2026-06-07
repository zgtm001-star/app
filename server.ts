import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase body limit to support base64 image uploads
app.use(express.json({ limit: "15mb" }));

let aiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing. Please verify it is in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Receipt parsing schema matching types in types.ts
const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    merchantName: { 
      type: Type.STRING, 
      description: "Name of the merchant/store (e.g., Starbucks, Blue Bottle Coffee, Target). Extract precisely." 
    },
    date: { 
      type: Type.STRING, 
      description: "Date of transaction. Format strictly as YYYY-MM-DD. If year is obscure but month/day is visible, assume year 2026 or parse logically." 
    },
    totalAmount: { 
      type: Type.NUMBER, 
      description: "The total amount paid including decimals. Numerical value only." 
    },
    taxAmount: { 
      type: Type.NUMBER, 
      description: "Extracted tax amount. Numerical value only. 0 if not present." 
    },
    category: { 
      type: Type.STRING, 
      description: "Categorize the receipt into one of: Dining, Travel, Supplies, Utilities, Rent, Subscriptions, Entertainment, Other." 
    },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name/description of the individual item line" },
          price: { type: Type.NUMBER, description: "Refined price for 1 unit of this item" },
          quantity: { type: Type.NUMBER, description: "Quantity of this item. Default to 1 if not stated." }
        },
        required: ["name", "price"]
      },
      description: "Array of individual line items purchased."
    }
  },
  required: ["merchantName", "totalAmount", "category"]
};

// API Endpoints
app.post("/api/process-receipt", async (req, res) => {
  try {
    const { image } = req.body; // base64 string with raw "data:image/..." format
    if (!image) {
      res.status(400).json({ error: "Missing receipt image payload" });
      return;
    }

    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      res.status(400).json({ error: "Invalid image format. Expected data URL with base64 encoded content." });
      return;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const ai = getGemini();

    const imagePart = {
      inlineData: {
        mimeType,
        data: base64Data
      }
    };

    const textPart = {
      text: `You are an expert OCR ledger scanner. Scan the attached receipt image and extract structured fields:
1. merchantName (merchant logo/title)
2. date (strictly in YYYY-MM-DD format)
3. totalAmount (total paid)
4. taxAmount (sales tax if listed, otherwise default to 0)
5. category ( Dining, Travel, Supplies, Utilities, Rent, Subscriptions, Entertainment, or Other)
6. items (detailed list of products with unit price and quantities).

Return JSON matching the schema precisely.`
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema,
        temperature: 0.1
      }
    });

    const parsedText = response.text;
    if (!parsedText) {
      throw new Error("Empty response returned from Gemini parsing.");
    }

    const receiptResult = JSON.parse(parsedText);
    res.json({ success: true, receipt: receiptResult });
  } catch (error: any) {
    console.error("Gemini OCR Processing Error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "An error occurred while processing the receipt with Gemini AI." 
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Receipt Ledger Service" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server executing at http://localhost:${PORT}`);
  });
}

startServer();

import { GoogleGenerativeAI } from "@google/generative-ai";

const getApiKey = () => {
    return localStorage.getItem('gemini_api_key') || process.env.GEMINI_API_KEY || "";
};

export interface ImportMapping {
  type: 'loans' | 'repayments' | 'unknown';
  borrowerName?: string;
  amount?: string;
  date?: string;
  interestRate?: string;
  term?: string;
}

export const analyzeImportData = async (headers: string[]): Promise<ImportMapping> => {
  try {
    const key = getApiKey();
    if (!key) throw new Error("No API Key configured");
    
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `
      Analyze these column headers from a data import file for a microfinance system.
      Determine if this is loan data or repayment data, and map the headers to our system fields.
      
      Headers: ${JSON.stringify(headers)}
      
      Return a JSON object with:
      - type: "loans" | "repayments" | "unknown"
      - borrowerName: the header that contains borrower/client names
      - amount: the header for loan amount or payment amount
      - date: the header for date (optional)
      - interestRate: the header for interest rate (loans only)
      - term: the header for loan term/months (loans only)
      
      Be flexible with header names - look for variations like "Name", "Client", "Borrower", 
      "Amount", "Principal", "Payment", "Date", "Disbursement Date", "Payment Date", etc.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonStr = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error: any) {
    console.error("AI mapping error:", error);
    
    // Fallback: simple keyword matching
    const headerLower = headers.map(h => h.toLowerCase());
    
    const borrowerName = headers.find(h => 
      h.toLowerCase().includes('name') || 
      h.toLowerCase().includes('borrower') ||
      h.toLowerCase().includes('client')
    );
    
    const amount = headers.find(h => 
      h.toLowerCase().includes('amount') || 
      h.toLowerCase().includes('principal') ||
      h.toLowerCase().includes('payment') ||
      h.toLowerCase().includes('value')
    );
    
    const date = headers.find(h => 
      h.toLowerCase().includes('date')
    );
    
    const interestRate = headers.find(h => 
      h.toLowerCase().includes('rate') || 
      h.toLowerCase().includes('interest')
    );
    
    const term = headers.find(h => 
      h.toLowerCase().includes('term') || 
      h.toLowerCase().includes('months') ||
      h.toLowerCase().includes('duration')
    );
    
    // Determine type based on keywords
    let type: 'loans' | 'repayments' | 'unknown' = 'unknown';
    if (interestRate || term || headerLower.some(h => h.includes('loan') || h.includes('disburse'))) {
      type = 'loans';
    } else if (headerLower.some(h => h.includes('payment') || h.includes('repay'))) {
      type = 'repayments';
    }
    
    return { type, borrowerName, amount, date, interestRate, term };
  }
};
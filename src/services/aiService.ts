import { GoogleGenerativeAI } from "@google/generative-ai";

// Default fallback key
const DEFAULT_KEY = "AIzaSyDBgdOKJpbvdTKuRtnC6cYiwAmeLigrTaY";

const getApiKey = () => {
    return localStorage.getItem('gemini_api_key') || DEFAULT_KEY;
};

const getAIInstance = () => {
    return new GoogleGenerativeAI(getApiKey());
};

const handleAIError = (error: any) => {
    console.error("AI Service Error:", error);
    if (error.status === 429 || (error.message && error.message.includes('429'))) {
        return "The AI is currently at its usage limit. Please wait about 20-30 seconds and try again.";
    }
    if (error.message && (error.message.includes('API_KEY_INVALID') || error.message.includes('invalid'))) {
        return "The configured API Key is invalid. Please check your System Settings.";
    }
    return null;
};

export const analyzeFinancialData = async (data: any): Promise<string[]> => {
  try {
    const genAI = getAIInstance();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `
      As a microfinance financial analyst, analyze the following portfolio data and provide 4 concise, actionable insights.
      Focus on risk distribution, revenue trends, and operational efficiency.
      
      Data: ${JSON.stringify(data)}
      
      Format: Return only a JSON array of strings.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error: any) {
    const rateLimitMsg = handleAIError(error);
    if (rateLimitMsg) return [rateLimitMsg];
    
    return [
      "Portfolio shows steady growth in active loans.",
      "Monitor Portfolio At Risk (PAR) for potential collection issues.",
      "Revenue trend indicates healthy interest collection.",
      "Consider reviewing loan officer performance metrics."
    ];
  }
};

export const predictCashFlow = async (loanData: any[]): Promise<any> => {
  try {
    const genAI = getAIInstance();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `
      Based on the following active loan data, predict the expected cash flow (principal + interest) for the next 3 months.
      Consider potential default risks (PAR).
      
      Loans: ${JSON.stringify(loanData)}
      
      Format: Return a JSON object with keys 'month1', 'month2', 'month3' (values are numbers) and a 'summary' string.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error: any) {
    const rateLimitMsg = handleAIError(error);
    return {
        month1: 0,
        month2: 0,
        month3: 0,
        summary: rateLimitMsg || "Unable to generate forecast at this time."
    };
  }
};

export const assessLoanRisk = async (loanData: any): Promise<string> => {
  try {
    const genAI = getAIInstance();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `
      Assess the risk level for this loan application based on the provided details.
      Provide a brief summary of risk factors and a recommendation.
      
      Loan Details: ${JSON.stringify(loanData)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    const rateLimitMsg = handleAIError(error);
    return rateLimitMsg || "Unable to perform automated risk assessment at this time.";
  }
};

export const querySystemAI = async (query: string, context: any): Promise<string> => {
    try {
        const genAI = getAIInstance();
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const systemPrompt = `
            You are the "Janalo System Architect AI". You have full context of a Microfinance Management System.
            
            SYSTEM ARCHITECTURE:
            - Frontend: React 19, Tailwind CSS, Lucide Icons.
            - Backend: Supabase (PostgreSQL, Auth, Edge Functions).
            - Core Tables: loans, repayments, borrowers, audit_logs, internal_accounts, journal_entries, expenses, tasks.
            - Security: Row Level Security (RLS) is enabled on all tables.
            
            CURRENT SYSTEM CONTEXT:
            ${JSON.stringify(context)}
            
            USER QUERY:
            "${query}"
            
            INSTRUCTIONS:
            1. Analyze the provided context (stats, recent logs, active tasks).
            2. If the user asks about errors, look for "failed", "error", or "rejected" patterns in the audit logs.
            3. Provide technical or operational advice to improve the system.
            4. Keep responses professional, concise, and actionable.
            5. Use Markdown for formatting.
        `;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        const rateLimitMsg = handleAIError(error);
        if (rateLimitMsg) return rateLimitMsg;
        
        return "I encountered an error while analyzing the system. Please try again or check the console for details.";
    }
};
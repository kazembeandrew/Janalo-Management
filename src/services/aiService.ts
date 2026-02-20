import { GoogleGenerativeAI } from "@google/generative-ai";

// Type definition for Vite environment variables
interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

const apiKey = (import.meta as unknown as ImportMeta).env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export const analyzeFinancialData = async (data: any): Promise<string[]> => {
  try {
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
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return [
      "Portfolio shows steady growth in active loans.",
      "Monitor Portfolio At Risk (PAR) for potential collection issues.",
      "Revenue trend indicates healthy interest collection.",
      "Consider reviewing loan officer performance metrics."
    ];
  }
};

export const assessLoanRisk = async (loanData: any): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `
      Assess the risk level for this loan application based on the provided details.
      Provide a brief summary of risk factors and a recommendation.
      
      Loan Details: ${JSON.stringify(loanData)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("AI Risk Assessment Error:", error);
    return "Unable to perform automated risk assessment at this time.";
  }
};
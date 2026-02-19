import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const analyzeFinancialData = async (data: any) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          parts: [
            {
              text: `You are a senior financial analyst for a microfinance company named Janalo. 
              Analyze the following financial data and provide 3-4 concise, actionable insights or warnings.
              Focus on portfolio health, revenue trends, and risk management.
              Format the output as a JSON array of strings.
              
              Data: ${JSON.stringify(data)}`
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return ["Unable to generate AI insights at this time."];
  }
};

export const assessLoanRisk = async (loan: any, borrower: any, history: any) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          parts: [
            {
              text: `Analyze the risk of this loan application for Janalo Microfinance.
              Borrower: ${JSON.stringify(borrower)}
              Loan Details: ${JSON.stringify(loan)}
              Repayment History: ${JSON.stringify(history)}
              
              Provide a risk score (1-10, where 1 is low risk), a brief justification, and a recommendation (Approve, Reassess, or Reject).
              Format the output as a JSON object with keys: score, justification, recommendation.`
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Risk Assessment Error:", error);
    return null;
  }
};

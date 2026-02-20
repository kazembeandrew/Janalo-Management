# Janalo Management - AI Development Rules

This document outlines the technical stack and architectural rules for the Janalo Management System.

## Tech Stack

*   **Frontend Framework**: React 19 with TypeScript for type-safe component development.
*   **Routing**: React Router v7 (using `HashRouter` for compatibility).
*   **Styling**: Tailwind CSS for all UI styling, following a utility-first approach.
*   **Backend-as-a-Service**: Supabase for Authentication, PostgreSQL Database, Edge Functions, and Realtime presence/notifications.
*   **Icons**: Lucide React for consistent, accessible iconography.
*   **Data Visualization**: Recharts for financial dashboards and reporting.
*   **AI Integration**: Google Gemini 2.0 Flash (via `@google/genai`) for financial insights and risk assessment.
*   **Image Processing**: `react-image-crop` for document and collateral photo handling.
*   **Server**: Express.js for administrative API routes (user creation, password resets).
*   **Build Tool**: Vite for fast development and optimized production builds.

## Library Usage Rules

### 1. UI Components & Styling
*   **Tailwind CSS**: Use Tailwind classes for all layout, spacing, and coloring. Avoid custom CSS files unless absolutely necessary for third-party library overrides.
*   **Lucide React**: Always use Lucide for icons. Maintain consistent sizing (usually `h-4 w-4` or `h-5 w-5`).
*   **Responsive Design**: Always use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) to ensure the app works on mobile devices used by loan officers in the field.

### 2. State Management & Data Fetching
*   **Supabase Client**: Use the singleton client from `@/lib/supabase`.
*   **Context API**: Use React Context for global state like `AuthContext` and `PresenceContext`.
*   **Realtime**: Use Supabase channels for live updates on messages and notification counts.

### 3. Financial Logic
*   **Utility Functions**: All loan calculations (Amortization, Interest, Repayment distribution) must reside in `@/utils/finance.ts` to ensure consistency between the calculator and the ledger.
*   **Currency**: Always use the `formatCurrency` utility which is configured for Malawian Kwacha (MK).

### 4. AI & Analysis
*   **AI Service**: All prompts and Gemini interactions should be handled through `@/services/aiService.ts`.
*   **Privacy**: Never send raw PII (Personally Identifiable Information) to the AI; focus on financial metrics and anonymized notes.

### 5. File Structure
*   **Pages**: Located in `src/pages/`.
*   **Components**: Located in `src/components/`.
*   **Types**: Centralized in `src/types.ts`.
*   **Imports**: Use the `@/` alias for all internal imports to maintain clean paths.

# AI Prompt for Building the Esano Genealogy Explorer Application

## Project Overview

You are an expert AI coding assistant. Your task is to build a full-stack web application called "Esano," a personal genealogy explorer. The application allows users to upload their raw DNA data to uncover their ancestry, connect with relatives, and understand their heritage through the power of AI.

## Core Technologies

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **UI Components:** ShadCN/UI. Initialize it with the "default" style and "neutral" color. Use `lucide-react` for icons.
*   **AI Integration:** Genkit with the Google AI plugin.
*   **Charts:** Recharts for data visualization.
*   **Fonts:** Use Google Fonts: 'Playfair Display' for headlines and 'PT Sans' for body text.

---

## Step-by-Step Implementation Plan

### 1. Project Setup & Styling

1.  **Initialize a Next.js Project:** Set up a new Next.js project with TypeScript and Tailwind CSS.
2.  **Integrate ShadCN/UI:** Add the standard ShadCN components (Button, Card, Input, etc.).
3.  **Configure `globals.css`:** Set up the application's theme using CSS variables. Use the following HSL values for the light theme:
    *   `--background: 120 17% 95%`
    *   `--foreground: 120 25% 15%`
    *   `--primary: 120 39% 37%`
    *   `--accent: 45 65% 52%`
    *   And other associated theme colors.
4.  **Configure `tailwind.config.ts`:**
    *   Define `body` (`PT Sans`) and `headline` (`Playfair Display`) font families.
    *   Map the CSS variables for colors (background, foreground, primary, secondary, accent, etc.).
5.  **Create a `Logo` Component:** Design a simple, abstract SVG logo representing a double helix or interconnectedness.

### 2. Create the Public-Facing Pages

1.  **Landing Page (`src/app/page.tsx`):**
    *   Create a marketing-style landing page.
    *   **Header:** Include the app name "Esano," the logo, and "Log In" / "Get Started" buttons that link to `/dashboard`.
    *   **Hero Section:** A main headline like "Discover Your Story" with a descriptive paragraph and a primary call-to-action button.
    *   **Features Section:** A grid of `Card` components highlighting key features: AI-Powered DNA Analysis, Find Relatives, Detailed Ancestry Reports, Generational Insights, and AI Genealogy Assistant. Each card should have an icon, a title, and a short description.
    *   **Footer:** A simple footer with a copyright notice.

### 3. Build the Authenticated Dashboard

1.  **Dashboard Layout (`src/app/dashboard/layout.tsx`):**
    *   Create a two-column layout using a sidebar for navigation. Use the ShadCN `Sidebar` component or build one from scratch.
    *   **Sidebar:**
        *   Include the Logo and App Name.
        *   Navigation links with icons: Dashboard, DNA Analysis, Relatives, Ancestry, Insights, Assistant.
    *   **Main Content Area:**
        *   A header with a user profile avatar and dropdown menu.
        *   An inset area to render the child pages.

2.  **Application Context (`src/contexts/app-context.tsx`):**
    *   Create a React Context to manage the application's state, including analysis results (`relatives`, `ancestry`, `insights`), loading status (`isAnalyzing`), and completion status (`analysisCompleted`).

### 4. Implement the AI Backend with Genkit

1.  **Genkit Setup (`src/ai/genkit.ts`):**
    *   Initialize Genkit with the `googleAI` plugin, configured to use the `GEMINI_API_KEY` from environment variables.

2.  **Create Genkit AI Flows (`src/ai/flows/`):**
    *   **Relative Prediction (`ai-dna-prediction.ts`):**
        *   Define a flow that takes user DNA data and a list of other users' DNA data.
        *   The flow should use a Gemini model to predict potential relatives, the relationship (e.g., "2nd cousin"), a confidence score, and shared DNA amount (centimorgans).
        *   The output should be a JSON array of relative objects.
    *   **Ancestry Estimation (`ai-ancestry-estimation.ts`):**
        *   Define a flow that takes user DNA data.
        *   The prompt should ask the AI to generate a detailed ethnicity estimate as a single string (e.g., "45.5% European, 30.2% West African, ...").
    *   **Generational Insights (`ai-generational-insights.ts`):**
        *   Define a flow that analyzes genetic markers.
        *   The prompt should instruct the AI to generate three separate string outputs: `healthInsights`, `traitInsights`, and `ancestryInsights`. Include a disclaimer for health insights that it is not medical advice.
    *   **Genealogy Assistant (`ai-genealogy-assistant.ts`):**
        *   Define a flow that takes a user's text query.
        *   The prompt should instruct the AI to act as a helpful genealogy assistant, answering the user's question based on general knowledge.
        *   The output should be a single string response.

3.  **Server Actions (`src/app/actions.ts`):**
    *   Create a server action `analyzeDna` that takes mock DNA data, calls the relative, ancestry, and insights flows in parallel using `Promise.all`, and returns the combined results.
    *   Create a server action `getAssistantResponse` that takes a user's query, calls the genealogy assistant flow, and returns the text response. Implement try-catch blocks to return a friendly error message on failure.

### 5. Create the Core Feature Pages

1.  **DNA Upload Page (`src/app/dashboard/dna-analysis/page.tsx`):**
    *   A primary `Card` containing a file upload form.
    *   Implement a drag-and-drop file input area.
    *   On "Start Analysis" button click, call the `analyzeDna` server action, update the app context with the results, and navigate the user to the dashboard home or relatives page.
    *   Show a loading state while analysis is in progress.
    *   Use toasts to show success or failure notifications.

2.  **Relatives Page (`src/app/dashboard/relatives/page.tsx`):**
    *   Display a grid of `RelativeCard` components based on the `relatives` data from the context.
    *   Each card should show the relative's predicted relationship, confidence score (as a `Progress` bar), and shared DNA.
    *   Include a placeholder state for when no analysis has been run or no relatives are found.

3.  **Ancestry Page (`src/app/dashboard/ancestry/page.tsx`):**
    *   Parse the string data from the `ancestry` context state.
    *   Use `recharts` to display the ethnicity estimates in a `PieChart`.
    *   Show a list or legend of the ethnicities and their percentages next to the chart.
    *   Include a placeholder state.

4.  **Insights Page (`src/app/dashboard/insights/page.tsx`):**
    *   Display the `healthInsights`, `traitInsights`, and `ancestryInsights` from the context in separate `Card` components.
    *   Include a prominent disclaimer that health insights are not medical advice.
    *   Include a placeholder state.

5.  **Assistant Page (`src/app/dashboard/assistant/page.tsx`):**
    *   Create a full-height chat interface.
    *   Display a scrollable history of messages between the user and the assistant.
    *   Use an `Input` field and a `Button` to send messages.
    *   On submit, call the `getAssistantResponse` server action and append the user's message and the assistant's response to the chat history.
    *   Show a loading indicator while the assistant is "typing."

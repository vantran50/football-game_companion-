# Football Draft Companion App

## Getting Started

1.  **Install Dependencies** (If you haven't already):
    ```bash
    npm install
    ```

2.  **Start the Dev Server**:
    ```bash
    npm run dev
    ```

3.  **Open the App**:
    -   Click the link in the terminal (usually `http://localhost:5173`).

## How to Play (Supabase Connected)

This app uses Supabase for real-time multiplayer.

1.  **Configuration**:
    -   Ensure you have a valid `.env` or `.env.local` file with:
        ```
        VITE_SUPABASE_URL=your_project_url
        VITE_SUPABASE_ANON_KEY=your_anon_key
        ```

2.  **Join Screen**:
    -   **Admin**: Open the app, select "I'm the Admin", and "Start Setup". This creates a new room in the database.
    -   **Player**: Open the app on another device (or tab), select "I'm a Player", enter the Room Code shown on the Admin screen, and your name.


2.  **Setup**:
    -   Add Participants (e.g., "Mike", "John").
    -   Set Buy-In.
    -   Click **Start Draft**.

3.  **The Draft**:
    -   You will see the "Snake Draft" board.
    -   Click players to select them for the active Drafter.
    -   The app auto-switches turns.

4.  **Live Dashboard**:
    -   Once drafting is complete, you see the Dashboard.
    -   Click **"Touchdown Home"** to simulate a score.
    -   Select the player who scored.
    -   The app awards the pot and resets the drafting order!

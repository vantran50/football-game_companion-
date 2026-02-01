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

## How to Play (Local/Mock Mode)

Since we haven't connected a real Supabase backend yet, the app runs in **Local Memory**. Refreshing the page will reset the game.

1.  **Join Screen**:
    -   Open the app in one tab. Cick **"I'm the Admin"** -> **Create Room**.
    -   (Optional) Open the app in a second tab (Incognito). Click **"I'm a Player"**, enter a name, and join. *Note: Since we are mocking, the "Room Code" doesn't actually network between tabs yet. For V1 testing, just use the Admin view to add "test users" manually in Setup.*

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

# ESPN API Integration Spec

## Goal
Replace mock roster data with live NFL game/roster data from ESPN's public API.

## Current State

**Mock data location:** [SetupScreen.jsx](file:///Users/van/Documents/football%20app/src/components/SetupScreen.jsx) lines 7-69

```javascript
const MOCK_ROSTERS = {
    '1': {
        home: [{ id: 'det-1', name: 'Jared Goff', pos: 'QB', num: 16 }, ...],
        away: [{ id: 'gb-1', name: 'Jordan Love', pos: 'QB', num: 10 }, ...]
    }
};

const MOCK_GAMES = [
    { id: '1', label: 'Lions vs Packers', home: { id: 'DET', name: 'Lions', color: '#0076B6' }, away: {...} }
];
```

## Required Data Shape

Keep the same shape so no reducer changes needed:

```typescript
// Game selection dropdown
interface Game {
    id: string;           // ESPN event ID
    label: string;        // "Lions vs Packers"
    home: { id: string; name: string; color: string; }
    away: { id: string; name: string; color: string; }
}

// Roster per team
interface Player {
    id: string;    // Unique player ID
    name: string;  // "Jared Goff"
    pos: string;   // "QB", "RB", "WR", "TE", "DST"
    num: number;   // Jersey number
}

// Roster object
{ home: Player[], away: Player[] }
```

## ESPN API Endpoints (Public, no auth)

| Endpoint | Returns |
|----------|---------|
| `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` | Today's games |
| `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{teamId}/roster` | Team roster |

## Files to Modify

1. **Create** `src/lib/espn.js` - API fetch functions
2. **Modify** `SetupScreen.jsx` - Replace mock data with API calls

## Implementation Notes

- Filter roster to skill positions (QB, RB, WR, TE) + add DST entry
- Handle loading/error states in UI
- Consider caching rosters during session

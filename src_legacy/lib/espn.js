/**
 * ESPN API utilities for fetching NFL games and rosters
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

// Team color mapping (ESPN doesn't always provide good colors)
const TEAM_COLORS = {
    ARI: '#97233F', ATL: '#A71930', BAL: '#241773', BUF: '#00338D',
    CAR: '#0085CA', CHI: '#0B162A', CIN: '#FB4F14', CLE: '#311D00',
    DAL: '#003594', DEN: '#FB4F14', DET: '#0076B6', GB: '#203731',
    HOU: '#03202F', IND: '#002C5F', JAX: '#006778', KC: '#E31837',
    LAC: '#0080C6', LAR: '#003594', LV: '#000000', MIA: '#008E97',
    MIN: '#4F2683', NE: '#002244', NO: '#D3BC8D', NYG: '#0B2265',
    NYJ: '#125740', PHI: '#004C54', PIT: '#FFB612', SEA: '#002244',
    SF: '#AA0000', TB: '#D50A0A', TEN: '#0C2340', WAS: '#5A1414',
    AFC: '#D50A0A', NFC: '#003594'
};

// All 32 NFL Teams for roster import
export const NFL_TEAMS = [
    { id: '22', abbrev: 'ARI', name: 'Cardinals' },
    { id: '1', abbrev: 'ATL', name: 'Falcons' },
    { id: '33', abbrev: 'BAL', name: 'Ravens' },
    { id: '2', abbrev: 'BUF', name: 'Bills' },
    { id: '29', abbrev: 'CAR', name: 'Panthers' },
    { id: '3', abbrev: 'CHI', name: 'Bears' },
    { id: '4', abbrev: 'CIN', name: 'Bengals' },
    { id: '5', abbrev: 'CLE', name: 'Browns' },
    { id: '6', abbrev: 'DAL', name: 'Cowboys' },
    { id: '7', abbrev: 'DEN', name: 'Broncos' },
    { id: '8', abbrev: 'DET', name: 'Lions' },
    { id: '9', abbrev: 'GB', name: 'Packers' },
    { id: '34', abbrev: 'HOU', name: 'Texans' },
    { id: '11', abbrev: 'IND', name: 'Colts' },
    { id: '30', abbrev: 'JAX', name: 'Jaguars' },
    { id: '12', abbrev: 'KC', name: 'Chiefs' },
    { id: '24', abbrev: 'LAC', name: 'Chargers' },
    { id: '14', abbrev: 'LAR', name: 'Rams' },
    { id: '13', abbrev: 'LV', name: 'Raiders' },
    { id: '15', abbrev: 'MIA', name: 'Dolphins' },
    { id: '16', abbrev: 'MIN', name: 'Vikings' },
    { id: '17', abbrev: 'NE', name: 'Patriots' },
    { id: '18', abbrev: 'NO', name: 'Saints' },
    { id: '19', abbrev: 'NYG', name: 'Giants' },
    { id: '20', abbrev: 'NYJ', name: 'Jets' },
    { id: '21', abbrev: 'PHI', name: 'Eagles' },
    { id: '23', abbrev: 'PIT', name: 'Steelers' },
    { id: '25', abbrev: 'SF', name: '49ers' },
    { id: '26', abbrev: 'SEA', name: 'Seahawks' },
    { id: '27', abbrev: 'TB', name: 'Buccaneers' },
    { id: '10', abbrev: 'TEN', name: 'Titans' },
    { id: '28', abbrev: 'WAS', name: 'Commanders' }
].sort((a, b) => a.name.localeCompare(b.name));

/**
 * Fetch today's NFL games from ESPN
 * @returns {Promise<Array>} Array of game objects
 */
export async function fetchGames() {
    try {
        const res = await fetch(`${ESPN_BASE}/scoreboard`);
        if (!res.ok) throw new Error('Failed to fetch games');

        const data = await res.json();

        return (data.events || []).map(event => {
            const competition = event.competitions?.[0];
            if (!competition) return null;

            const homeTeam = competition.competitors?.find(c => c.homeAway === 'home')?.team;
            const awayTeam = competition.competitors?.find(c => c.homeAway === 'away')?.team;

            if (!homeTeam || !awayTeam) return null;

            return {
                id: event.id,
                label: `${awayTeam.shortDisplayName || awayTeam.displayName} @ ${homeTeam.shortDisplayName || homeTeam.displayName}`,
                status: competition.status?.type?.description || 'Scheduled',
                date: event.date,
                home: {
                    id: homeTeam.id,
                    abbrev: homeTeam.abbreviation,
                    name: homeTeam.shortDisplayName || homeTeam.displayName,
                    color: TEAM_COLORS[homeTeam.abbreviation] || '#333333'
                },
                away: {
                    id: awayTeam.id,
                    abbrev: awayTeam.abbreviation,
                    name: awayTeam.shortDisplayName || awayTeam.displayName,
                    color: TEAM_COLORS[awayTeam.abbreviation] || '#333333'
                }
            };
        }).filter(Boolean);
    } catch (error) {
        console.error('ESPN fetchGames error:', error);
        throw error;
    }
}

/**
 * Fetch roster for a specific team
 * @param {string} teamId - ESPN team ID
 * @param {string} teamAbbrev - Team abbreviation for player IDs
 * @returns {Promise<Array>} Array of player objects
 */
export async function fetchRoster(teamId, teamAbbrev) {
    try {
        const res = await fetch(`${ESPN_BASE}/teams/${teamId}/roster`);
        if (!res.ok) throw new Error(`Failed to fetch roster for team ${teamId}`);

        const data = await res.json();
        const players = [];

        // Skill positions we care about
        const SKILL_POSITIONS = ['QB', 'RB', 'WR', 'TE'];

        // Process each position group (offense, defense, special)
        for (const group of data.athletes || []) {
            for (const athlete of group.items || []) {
                const pos = athlete.position?.abbreviation;

                if (SKILL_POSITIONS.includes(pos)) {
                    players.push({
                        id: `${teamAbbrev.toLowerCase()}-${athlete.id}`,
                        name: athlete.fullName || athlete.displayName,
                        pos: pos,
                        num: parseInt(athlete.jersey, 10) || 0
                    });
                }
            }
        }

        // Add team defense as DST
        players.push({
            id: `${teamAbbrev.toLowerCase()}-dst`,
            name: `${teamAbbrev} Defense`,
            pos: 'DST',
            num: 0
        });

        // Sort by position priority, then number
        const posOrder = { QB: 1, RB: 2, WR: 3, TE: 4, DST: 5 };
        players.sort((a, b) => {
            const posDiff = (posOrder[a.pos] || 99) - (posOrder[b.pos] || 99);
            return posDiff !== 0 ? posDiff : a.num - b.num;
        });

        return players;
    } catch (error) {
        console.error('ESPN fetchRoster error:', error);
        throw error;
    }
}

/**
 * Fetch rosters for both teams in a game
 * @param {Object} game - Game object from fetchGames
 * @returns {Promise<{home: Array, away: Array}>}
 */
export async function fetchGameRosters(game) {
    const [homeRoster, awayRoster] = await Promise.all([
        fetchRoster(game.home.id, game.home.abbrev),
        fetchRoster(game.away.id, game.away.abbrev)
    ]);

    return {
        home: homeRoster,
        away: awayRoster
    };
}

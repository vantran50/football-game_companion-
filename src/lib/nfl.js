export const NFL_TEAMS = {
    DET: { name: 'Detroit Lions', color: 'bg-blue-500' },
    GB: { name: 'Green Bay Packers', color: 'bg-green-700' },
    KC: { name: 'Kansas City Chiefs', color: 'bg-red-600' },
    SF: { name: 'San Francisco 49ers', color: 'bg-red-500' },
    BAL: { name: 'Baltimore Ravens', color: 'bg-purple-700' },
    PHI: { name: 'Philadelphia Eagles', color: 'bg-teal-700' },
};

export const MOCK_PLAYERS = {
    DET: [
        { name: 'Jared Goff', pos: 'QB', num: 16 },
        { name: 'Amon-Ra St. Brown', pos: 'WR', num: 14 },
        { name: 'Jahmyr Gibbs', pos: 'RB', num: 26 },
        { name: 'David Montgomery', pos: 'RB', num: 5 },
        { name: 'Sam LaPorta', pos: 'TE', num: 87 },
        { name: 'Jameson Williams', pos: 'WR', num: 9 },
        { name: 'Aidan Hutchinson', pos: 'DE', num: 97 },
        { name: 'Brian Branch', pos: 'S', num: 32 },
        { name: 'Jack Campbell', pos: 'LB', num: 46 },
        { name: 'Alex Anzalone', pos: 'LB', num: 34 }
    ],
    GB: [
        { name: 'Jordan Love', pos: 'QB', num: 10 },
        { name: 'Josh Jacobs', pos: 'RB', num: 8 },
        { name: 'Jayden Reed', pos: 'WR', num: 1 },
        { name: 'Christian Watson', pos: 'WR', num: 9 },
        { name: 'Romeo Doubs', pos: 'WR', num: 87 },
        { name: 'Luke Musgrave', pos: 'TE', num: 88 },
        { name: 'Jaire Alexander', pos: 'CB', num: 23 },
        { name: 'Rashan Gary', pos: 'LB', num: 52 },
        { name: 'Quay Walker', pos: 'LB', num: 7 },
        { name: 'Kenny Clark', pos: 'DT', num: 97 }
    ],
    KC: [
        { name: 'Patrick Mahomes', pos: 'QB', num: 15 },
        { name: 'Travis Kelce', pos: 'TE', num: 87 },
        { name: 'Isiah Pacheco', pos: 'RB', num: 10 },
        { name: 'Rashee Rice', pos: 'WR', num: 4 },
        { name: 'Xavier Worthy', pos: 'WR', num: 1 },
        { name: 'Chris Jones', pos: 'DT', num: 95 },
        { name: 'Nick Bolton', pos: 'LB', num: 32 },
        { name: 'Trent McDuffie', pos: 'CB', num: 22 },
        { name: 'George Karlaftis', pos: 'DE', num: 56 },
        { name: 'Harrison Butker', pos: 'K', num: 7 }
    ],
    SF: [
        { name: 'Brock Purdy', pos: 'QB', num: 13 },
        { name: 'Christian McCaffrey', pos: 'RB', num: 23 },
        { name: 'Deebo Samuel', pos: 'WR', num: 19 },
        { name: 'Brandon Aiyuk', pos: 'WR', num: 11 },
        { name: 'George Kittle', pos: 'TE', num: 85 },
        { name: 'Nick Bosa', pos: 'DE', num: 97 },
        { name: 'Fred Warner', pos: 'LB', num: 54 },
        { name: 'Charvarius Ward', pos: 'CB', num: 7 },
        { name: 'Talanoa Hufanga', pos: 'S', num: 29 },
        { name: 'Jake Moody', pos: 'K', num: 4 }
    ],
    // Defaults for others
    DEFAULT: [
        { name: 'Star Player 1', pos: 'QB', num: 1 },
        { name: 'Star Player 2', pos: 'WR', num: 88 },
        { name: 'Star Player 3', pos: 'RB', num: 20 },
        { name: 'Defense Captain', pos: 'LB', num: 55 },
    ]
};

export function getRoster(teamCode) {
    const roster = MOCK_PLAYERS[teamCode] || MOCK_PLAYERS.DEFAULT;
    // Add IDs
    return roster.map((p, i) => ({
        ...p,
        id: `${teamCode}-${i}`, // Stable ID
        price: 1 // Default price relevant?
    }));
}

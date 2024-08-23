class FootballFixtureCard extends HTMLElement {
  setConfig(config) {
    if (!window.customElements.get('hui-generic-entity-row')) {
      throw new Error('Resource is not loaded: hui-generic-entity-row');
    }

    // The configuration for your card
    this.config = config;
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        .card {
          padding: 16px;
          background-color: var(--ha-card-background, white);
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0,0,0,.15));
        }
        .date-group {
          margin-top: 16px;
          font-weight: bold;
          font-size: 1.2em;
        }
        .fixture {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .teams {
          display: flex;
          align-items: center;
        }
        .team-logo {
          height: 30px;
          width: 30px;
          margin-right: 10px;
        }
        .score {
          font-weight: bold;
        }
      </style>
      <div class="card">
        <h1>Football Fixture Card</h1>
        <div id="fixtures"></div>
      </div>
    `;
  }

  set hass(hass) {
    const entityId = this.config.entity;
    const state = hass.states[entityId];

    if (!state) {
      return;
    }

    const fixtures = state.attributes.fixtures || [];
    const root = this.shadowRoot;
    const fixturesContainer = root.getElementById('fixtures');

    // Clear any existing content
    fixturesContainer.innerHTML = '';

    // Group fixtures by date
    const groupedFixtures = fixtures.reduce((acc, fixture) => {
      const fixtureDate = new Date(fixture.date);
      const formattedDate = fixtureDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

      if (!acc[formattedDate]) {
        acc[formattedDate] = [];
      }
      acc[formattedDate].push(fixture);
      return acc;
    }, {});

    // Render grouped fixtures
    Object.keys(groupedFixtures).forEach(date => {
      const dateHeader = document.createElement('div');
      dateHeader.className = 'date-group';
      dateHeader.textContent = date;
      fixturesContainer.appendChild(dateHeader);

      groupedFixtures[date].forEach(fixture => {
        const fixtureElement = document.createElement('div');
        fixtureElement.className = 'fixture';

        const teamsElement = document.createElement('div');
        teamsElement.className = 'teams';
        teamsElement.innerHTML = `
          <img class="team-logo" src="${fixture.home_team_logo}" alt="${fixture.home_team} logo">
          <span>${fixture.home_team}</span>
          <span> vs </span>
          <span>${fixture.away_team}</span>
          <img class="team-logo" src="${fixture.away_team_logo}" alt="${fixture.away_team} logo">
        `;

        const scoreElement = document.createElement('div');
        scoreElement.className = 'score';
        scoreElement.innerHTML = `
          <span>${fixture.score.home ?? '-'}</span>
          <span> : </span>
          <span>${fixture.score.away ?? '-'}</span>
        `;

        fixtureElement.appendChild(teamsElement);
        fixtureElement.appendChild(scoreElement);
        fixturesContainer.appendChild(fixtureElement);
      });
    });
  }

  getCardSize() {
    return 3; // Size of your card, affects the height in the UI
  }
}

customElements.define('football-fixture-card', FootballFixtureCard);

// Code to show the card in HA card-picker
const FootballFixtureCardDescriptor = {
    type: 'football-fixture-card', // Must match the type you use in your YAML configuration
    name: 'Football Fixture Card', // Friendly name for the card picker
    description: 'A custom card to show football fixtures', // Short description
    preview: false, // Optional: Set to true to show a preview in the picker
    documentationURL: 'https://justpaste.it/38sr8' // Optional: Link to your documentation (replace with your actual documentation link if available)
};

// Ensure window.customCards is initialized
window.customCards = window.customCards || [];

// Add your card to the customCards array
window.customCards.push(FootballFixtureCardDescriptor);

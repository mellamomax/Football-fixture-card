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
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .arrow {
          cursor: pointer;
          font-size: 1.5em;
          user-select: none;
        }
        .round-title {
          font-weight: bold;
          font-size: 1.2em;
        }
        .date-group {
          margin-top: 16px;
          font-weight: bold;
          font-size: 1.2em;
        }
        .fixture {
          display: flex;
          flex-direction: column;
          margin-bottom: 10px;
        }
        .team-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
        }
        .team {
          display: flex;
          align-items: center;
        }
        .team-logo {
          height: 30px;
          width: 30px;
          margin-right: 10px;
        }
        .score {
          font-weight: normal;
        }
        .bold {
          font-weight: bold;
        }
        .spoiler {
          background-color: #000;
          color: #000;
          cursor: pointer;
          padding: 0 5px;
          border-radius: 3px;
        }
        .spoiler.revealed {
          color: inherit;
          background-color: inherit;
        }
      </style>
      <div class="card">
        <div class="header">
          <div id="prev-round" class="arrow">&larr;</div>
          <div id="round-title" class="round-title">Round 1</div>
          <div id="next-round" class="arrow">&rarr;</div>
        </div>
        <div id="fixtures"></div>
      </div>
    `;

    this.currentRound = 1;  // Initialize the current round, will be overwritten by the actual current round from hass
  }

  set hass(hass) {
    if (!this._hass || this._hass !== hass) {
      this._hass = hass;

      // Get the current round from the sensor's state attributes
      const entityId = this.config.entity;
      const state = this._hass.states[entityId];
      if (state && state.attributes.current_round) {
        this.currentRound = state.attributes.current_round;
      }

      // Add event listeners only once
      if (!this.listenersAdded) {
        this.shadowRoot.getElementById('prev-round').addEventListener('click', () => this.changeRound(-1));
        this.shadowRoot.getElementById('next-round').addEventListener('click', () => this.changeRound(1));
        this.listenersAdded = true;  // Flag to prevent adding listeners multiple times
      }

      // Display the current round's fixtures
      this.displayFixtures(this.currentRound);
    }
  }

  changeRound(direction) {
    this.currentRound += direction;
    if (this.currentRound < 1) {
      this.currentRound = 1;  // Prevent navigating to a round less than 1
    }
    this.displayFixtures(this.currentRound);
  }

  displayFixtures(round) {
    const entityId = this.config.entity;
    const state = this._hass.states[entityId];

    if (!state) {
      return;
    }

    const fixturesKey = `Round ${round} Fixtures`;
    const fixtures = state.attributes[fixturesKey] || [];
    const root = this.shadowRoot;
    const fixturesContainer = root.getElementById('fixtures');
    const roundTitle = root.getElementById('round-title');

    // Update round title
    roundTitle.textContent = `Round ${round}`;

    // Clear any existing content
    fixturesContainer.innerHTML = '';

    // Sort fixtures by date
    const sortedFixtures = fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Group fixtures by date
    const groupedFixtures = sortedFixtures.reduce((acc, fixture) => {
      const fixtureDate = new Date(fixture.date);
      const formattedDate = fixtureDate.toLocaleDateString('sv-SE', {
        weekday: 'short',
        day: 'numeric',
        month: 'long'
      });

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

        const homeTeamElement = document.createElement('div');
        homeTeamElement.className = 'team-container';
        homeTeamElement.innerHTML = `
          <div class="team">
            <img class="team-logo" src="${fixture.home_team_logo}" alt="${fixture.home_team} logo">
            <span>${fixture.home_team}</span>
          </div>
          <div class="score">${fixture.score.home ?? '-'}</div>
        `;

        const awayTeamElement = document.createElement('div');
        awayTeamElement.className = 'team-container';
        awayTeamElement.innerHTML = `
          <div class="team">
            <img class="team-logo" src="${fixture.away_team_logo}" alt="${fixture.away_team} logo">
            <span>${fixture.away_team}</span>
          </div>
          <div class="score">${fixture.score.away ?? '-'}</div>
        `;

        // Handle spoiler for Barcelona games
        if (fixture.home_team === 'Barcelona' || fixture.away_team === 'Barcelona') {
          homeTeamElement.querySelector('.score').innerHTML = `
            <span class="spoiler">Click to reveal</span>
          `;
          awayTeamElement.querySelector('.score').innerHTML = `
            <span class="spoiler">Click to reveal</span>
          `;
          homeTeamElement.querySelector('.score').addEventListener('click', function() {
            this.classList.add('revealed');
            this.innerHTML = `${fixture.score.home ?? '-'}`;
          });
          awayTeamElement.querySelector('.score').addEventListener('click', function() {
            this.classList.add('revealed');
            this.innerHTML = `${fixture.score.away ?? '-'}`;
          });
        }

        fixtureElement.appendChild(homeTeamElement);
        fixtureElement.appendChild(awayTeamElement);
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

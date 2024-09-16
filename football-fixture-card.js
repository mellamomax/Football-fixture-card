class FootballFixtureCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.listenersAdded = false;
  }

  setConfig(config) {
    if (!window.customElements.get('hui-generic-entity-row')) {
      throw new Error('Resource is not loaded: hui-generic-entity-row');
    }

    this.config = config;
    // Only render once
    if (!this.shadowRoot.innerHTML) {
      this.render();
    }
  }

  set hass(hass) {
    this._hass = hass;

    const entityId = this.config.entity;
    const state = this._hass.states[entityId];

    if (!state) {
      return;
    }

    // Get the current round from the sensor's state attributes
    if (state.attributes.current_round) {
      const currentRoundFromState = state.attributes.current_round;

      if (
        this.currentRound === null ||
        !this.currentRoundSetByUser ||
        this.currentRound === currentRoundFromState
      ) {
        this.currentRound = currentRoundFromState;
        this.currentRoundSetByUser = false; // reset the user-set flag
      }
    } else {
      this.currentRound = 1; // Default to Round 1 if no state is available
    }

    // Add event listeners only once
    if (!this.listenersAdded) {
      this.shadowRoot
        .getElementById('prev-round')
        .addEventListener('click', () => this.changeRound(-1));
      this.shadowRoot
        .getElementById('next-round')
        .addEventListener('click', () => this.changeRound(1));
      this.shadowRoot
        .getElementById('round-title')
        .addEventListener('click', () => this.returnToCurrentRound());
      this.listenersAdded = true; // Flag to prevent adding listeners multiple times
    }

    // Display the current round's fixtures
    this.displayFixtures(this.currentRound);
  }

  render() {
    const root = this.shadowRoot;
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
          cursor: pointer;  /* Make the round title clickable */
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
		.time-or-ft {
			font-size: 0.9em;
			color: var(--primary-text-color, #000);
			margin-left: 10px;
		}
        .team-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2px;
        }
        .team {
          display: flex;
          align-items: center;
        }
        .team-logo {
          height: 20px;
          width: 20px;
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
	

    this.currentRound = null; // Initialize the current round
  }	



  changeRound(direction) {
    const entityId = this.config.entity;
    const state = this._hass.states[entityId];
    if (!state) {
      return;
    }

    this.currentRound += direction;

    // If the current round is less than 1, reset it to 1
    if (this.currentRound < 1) {
      this.currentRound = 1;
    }

    // Ensure that the round does not go above the maximum available rounds
    if (state.attributes.max_round && this.currentRound > state.attributes.max_round) {
      this.currentRound = state.attributes.max_round;
    }

    // Mark that the user has manually set the round
    this.currentRoundSetByUser = true;

    // Display the fixtures for the new round
    this.displayFixtures(this.currentRound);
  }

  returnToCurrentRound() {
    const entityId = this.config.entity;
    const state = this._hass.states[entityId];
    if (!state || !state.attributes.current_round) {
      return;
    }

    // Set the current round back to the actual current round
    this.currentRound = state.attributes.current_round;
    this.currentRoundSetByUser = false; // Reset the user-set flag

    // Display the fixtures for the current round
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
        month: 'long',
      });

      if (!acc[formattedDate]) {
        acc[formattedDate] = [];
      }
      acc[formattedDate].push(fixture);
      return acc;
    }, {});

    // Render grouped fixtures
    Object.keys(groupedFixtures).forEach((date) => {
      const dateHeader = document.createElement('div');
      dateHeader.className = 'date-group';
      dateHeader.textContent = date;
      fixturesContainer.appendChild(dateHeader);

      groupedFixtures[date].forEach((fixture) => {
        const fixtureElement = document.createElement('div');
        fixtureElement.className = 'fixture';

        // Determine if the fixture has finished
        const fixtureDate = new Date(fixture.date);
        const now = new Date();
        const timeOrFT =
          fixtureDate < now
            ? 'FT'
            : fixtureDate.toLocaleTimeString('sv-SE', {
                hour: '2-digit',
                minute: '2-digit',
              });

		const teamId = Number(this.config.teamId) || 529; // Default to 529 (Barcelona) if not specified
		// Use strict equality '===' and ensure both sides are numbers
		const isTeamFixture =
		  fixture.home_team_id === teamId || fixture.away_team_id === teamId;

        // Determine if there is a winning team and style the score accordingly
        const homeScoreBold = fixture.score.home > fixture.score.away ? 'bold' : 'normal';
        const awayScoreBold = fixture.score.away > fixture.score.home ? 'bold' : 'normal';

        const homeTeamElement = document.createElement('div');
        homeTeamElement.className = 'team-container';
        homeTeamElement.innerHTML = `
          <div class="team">
            <img class="team-logo" src="${fixture.home_team_logo}" alt="${fixture.home_team} logo">
            <span class="${fixture.home_team_id === teamId ? 'bold' : ''}">${fixture.home_team}</span>
          </div>
          <div class="score" style="font-weight: ${homeScoreBold};">
            ${
              isTeamFixture
                ? '<span class="spoiler">Click to reveal</span>'
                : fixture.score.home ?? '-'
            }
          </div>
          <div class="time-or-ft">
            ${timeOrFT}
          </div>
        `;

        const awayTeamElement = document.createElement('div');
        awayTeamElement.className = 'team-container';
        awayTeamElement.innerHTML = `
          <div class="team">
            <img class="team-logo" src="${fixture.away_team_logo}" alt="${fixture.away_team} logo">
            <span class="${fixture.away_team_id === teamId ? 'bold' : ''}">${fixture.away_team}</span>
          </div>
          <div class="score" style="font-weight: ${awayScoreBold};">
            ${
              isTeamFixture
                ? '<span class="spoiler">Click to reveal</span>'
                : fixture.score.away ?? '-'
            }
          </div>
          <div class="time-or-ft">
            ${timeOrFT}
          </div>
        `;

        // Handle spoiler for Barcelona games
        if (isTeamFixture) {
          const homeScore = homeTeamElement.querySelector('.score');
          const awayScore = awayTeamElement.querySelector('.score');

          homeScore.addEventListener('click', function (event) {
            event.stopPropagation();
            this.classList.add('revealed');
            this.textContent = `${fixture.score.home ?? '-'}`;
          });
          awayScore.addEventListener('click', function (event) {
            event.stopPropagation();
            this.classList.add('revealed');
            this.textContent = `${fixture.score.away ?? '-'}`;
          });

          // Make the Barcelona fixture clickable to show more info
          const clickHandler = () => {
            const event = new Event('hass-more-info', {
              bubbles: true,
              cancelable: false,
              composed: true,
            });
            event.detail = { entityId: entityId };
            this.dispatchEvent(event);
          };

          fixtureElement.style.cursor = 'pointer';
          fixtureElement.addEventListener('click', clickHandler);
        }

        // Append fixture elements to the fixture element
        fixtureElement.appendChild(homeTeamElement);
        fixtureElement.appendChild(awayTeamElement);
        fixturesContainer.appendChild(fixtureElement);
      });
    });
  }
  
  getCardSize() {
    return 3; // Adjust as needed
  }
  
  static getConfigElement() {
    return document.createElement('football-fixture-card-editor');
  }

  static getStubConfig() {
    return {
      entity: '',
      teamId: '',
      league: '',
    };
  }
}

  

customElements.define('football-fixture-card', FootballFixtureCard);

// Code to show the card in HA card-picker
const FootballFixtureCardDescriptor = {
    type: 'football-fixture-card', // Must match the type you use in your YAML configuration
    name: 'Football Fixture Card', // Friendly name for the card picker
    description: 'A custom card to show football fixtures', // Short description
    preview: false, // Optional: Set to true to show a preview in the picker
    documentationURL: 'https://justpaste.it/38sr8', // Optional: Link to your documentation (replace with your actual documentation link if available)
};

// Ensure window.customCards is initialized
window.customCards = window.customCards || [];

// Add your card to the customCards array
window.customCards.push(FootballFixtureCardDescriptor);


class FootballFixtureCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._initialized = false;
    this.config = {};
    this.allEntities = [];
    this.filteredEntities = [];
    this.dropdownOpen = false;
    this.render(); // Initial render
  }

  setConfig(config) {
    this.config = { ...config };
    if (this._initialized) {
      this.updateInputValues();
    }
  }

  set hass(hass) {
    this._hass = hass;
    this.populateEntities();
  }

  render() {
    this.shadowRoot.innerHTML = `
		<style>
			.input-container {
				width: 93%; /* Adjusted to match the width of the original form-group */
				padding: 8px;
				height: 40px;
				border-bottom: 1px solid #818181;
				background-color: #f5f5f5;
				cursor: text;
				z-index: 1;
				margin-bottom: 10px;
				position: relative;
				line-height: 1.5;
				display: flex;
				align-items: center;
				justify-content: space-between;
			}

			.input-container:hover {
				background-color: #ececec; /* A darker shade when hovering */
			}

			.input-container label {
				display: block;
				color: var(--secondary-text-color);
				font-size: 11px;
				top: 12px;
				z-index: 1;
				position: absolute;
				margin-left: 10px;
			}

			.input-container:focus-within {
				border-bottom: 2px solid #3f3f3f; /* Border for the entire container */
			}

			.input-container input[type="text"],
			.input-container input[type="number"] {
				width: 100%;
				padding: 10px;
				border: 0px solid #818181;
				border-radius: 4px;
				background: none;
				color: black;
				margin-top: 18px; /* This will move the input box down by 5px */
				font-family: var(--mdc-typography-subtitle1-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));
				font-size: var(--mdc-typography-subtitle1-font-size, 1rem);
			}

			.input-container input[type="text"]:focus + label,
			.input-container input[type="number"]:focus + label,
			.input-container input[type="text"]:not(:placeholder-shown) + label,
			.input-container input[type="number"]:not(:placeholder-shown) + label {
				top: -10px;
				left: 10px;
				font-size: 12px;
				color: var(--primary-text-color);
			}

			.input-container input[type="text"]:focus,
			.input-container input[type="number"]:focus {
				border: none; /* This line will remove the border */
				outline: none; /* This line removes the default browser outline */
			}

			
			
			.dropdown {
				position: relative;
				border: none;
				margin-bottom: 10px;
			}
			.dropdown label {
				display: block;
				color: var(--secondary-text-color);
				font-size: 11px;
				top: 0px;
				z-index: 3;
				position: absolute;
				margin-left: 10px;
			}
			.dropdown-input-wrapper:hover {
				background-color: #ececec; /* A darker shade when hovering */
			}
			.dropdown-input-wrapper:focus-within {
				outline: none !important; /* Removes the default focus outline */
				border-left: none !important;
				border-right: none !important;
				border-top: none !important;
				border-bottom: 2px solid #3f3f3f;
			}
			.dropdown-list {
				position: absolute;
				z-index: 3;
				list-style: none;
				margin: 0;
				padding: 0px;
				background: white;
				border: 0px solid #818181;
				border-radius: 0px;
				box-sizing: border-box;
				box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.2); /* Add box shadow here */
				width: 96%;
				max-height: 200px; /* Limit the height of the dropdown */
				overflow-y: auto; /* Enable scrolling if too many items */
				display: none; /* Hidden by default */
			}
			.dropdown-list li {
				padding: 8px;
				height: 60px;
				cursor: pointer;
				#display: flex;
				#align-items: center;
			}
			.dropdown-list li:hover {
				background-color: #f0f0f0;
			}
			.dropdown-list li span {
				margin-left: 60px;
				margin-top: 5px;
			}
			.dropdown-list li span:nth-child(2) {
				color: #212121;
				font-size: smaller;
				position: absolute;
			}
			.dropdown-list li ha-icon {
				position: relative;
				left: 15px;
				top: 18px;
				color: #727272;
				margin-right: 8px;
			}
			.dropdown-input-wrapper {
				width: 93%;
				padding: 8px;
				height: 40px;
				border-bottom: 1px solid #818181;
				background-color: #f5f5f5;
				cursor: text;
				z-index: 1;
				position: relative;
				#margin-bottom: 24px;
				line-height: 40px;
				display: flex;
				align-items: center;
				justify-content: space-between;
			}
			.dropdown-input-wrapper #dropdown-input {
				width: 100%; /* Full width of the wrapper */
				border: none; /* No border */
				outline: none;
				background-color: transparent; /* Transparent background */
				color: var(--mdc-text-field-ink-color, rgba(0,0,0,.87)); /* Text color */
				font-family: var(--mdc-typography-subtitle1-font-family, Roboto, sans-serif);
				font-size: 1rem; /* Text size */
				line-height: 40px; /* Align with the height of the wrapper */
				text-indent: 7px;
				top: 15px;
				position: absolute;
			}
		</style>
		<div class="dropdown">
			<div class="dropdown-input-wrapper">
				<label for="dropdown-input">Entity*</label>
				<input type="text" id="dropdown-input" placeholder="Select an option" autocomplete="off">
			</div>
			<ul class="dropdown-list" id="entity-list" style="display: none;"></ul>
		</div>
		<div class="input-container">
		  <label for="team-id">Team Id</label>
		  <input id="team-id" type="text" value="${this.config.teamId || ''}">
		</div>
		<div class="input-container">
			<label for="league">League</label>
			<input id="league" type="number" value="${this.config.league || ''}">
		</div>
	`;

    this.dropdownInput = this.shadowRoot.querySelector('#dropdown-input');
    this.entityList = this.shadowRoot.querySelector('#entity-list');
    this.teamIdInput = this.shadowRoot.querySelector('#team-id');
    this.leagueInput = this.shadowRoot.querySelector('#league');

    this.addEventListeners();
    this._initialized = true;
  }

  addEventListeners() {
    this.dropdownInput.addEventListener('input', (e) => this.handleInput(e));
    this.dropdownInput.addEventListener('click', (e) => this.toggleDropdown(e));
    this.teamIdInput.addEventListener('change', (e) => this.handleTeamIdChange(e));
    this.leagueInput.addEventListener('change', (e) => this.handleLeagueChange(e));

    // Close the dropdown when clicking outside
    document.addEventListener('click', (event) => {
      if (!this.shadowRoot.contains(event.target)) {
        this.dropdownOpen = false;
        this.entityList.style.display = 'none';
      }
    });
  }

  updateInputValues() {
    this.dropdownInput.value = this.getEntityFriendlyName(this.config.entity);
    this.teamIdInput.value = this.config.teamId || '';
    this.leagueInput.value = this.config.league || '';
  }

  getEntityFriendlyName(entityId) {
    return this._hass.states[entityId]?.attributes?.friendly_name || entityId || '';
  }

  populateEntities() {
    if (!this._hass) return;

    this.allEntities = Object.keys(this._hass.states)
      .filter((entityId) => entityId.startsWith('sensor.')) // Adjust as needed
      .map((entityId) => ({
        entityId,
        friendlyName: this._hass.states[entityId].attributes.friendly_name || entityId,
      }))
      .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName));

    this.filteredEntities = [...this.allEntities];
    this.updateEntityList();
  }

  toggleDropdown(event) {
    event.stopPropagation(); // Prevent the document click listener from immediately closing it
    this.dropdownOpen = !this.dropdownOpen;
    this.entityList.style.display = this.dropdownOpen ? 'block' : 'none';
  }

  handleInput(e) {
    const searchTerm = e.target.value.trim().toLowerCase();
    this.filterEntities(searchTerm);
  }

  filterEntities(searchTerm) {
    this.filteredEntities = this.allEntities.filter(({ entityId, friendlyName }) => {
      return (
        friendlyName.toLowerCase().includes(searchTerm) ||
        entityId.toLowerCase().includes(searchTerm)
      );
    });
    this.updateEntityList();
  }

  updateEntityList() {
    this.entityList.innerHTML = '';

    if (this.filteredEntities.length > 0) {
      this.filteredEntities.forEach(({ entityId, friendlyName }) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
          <div style="display: flex; align-items: center;">
            <ha-icon icon="mdi:motion-sensor" style="margin-right: 8px;"></ha-icon>
            <span>${friendlyName}</span>
          </div>
          <span style="display: block; font-size: smaller; color: grey;">${entityId}</span>
        `;
        listItem.addEventListener('click', () => this.setEntity(entityId));
        this.entityList.appendChild(listItem);
      });
      this.entityList.style.display = this.dropdownOpen ? 'block' : 'none';
    } else {
      this.entityList.style.display = 'none';
    }
  }

  setEntity(entityId) {
    this.config.entity = entityId;
    this.dropdownInput.value = this.getEntityFriendlyName(entityId);
    this.dropdownOpen = false;
    this.entityList.style.display = 'none';
    this.dispatchConfigChanged();
  }

  handleTeamIdChange(e) {
    this.config.teamId = e.target.value;
    this.dispatchConfigChanged();
  }

  handleLeagueChange(e) {
    this.config.league = e.target.value;
    this.dispatchConfigChanged();
  }

  dispatchConfigChanged() {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        bubbles: true,
        composed: true,
        detail: { config: this.config },
      })
    );
  }
}

customElements.define('football-fixture-card-editor', FootballFixtureCardEditor);

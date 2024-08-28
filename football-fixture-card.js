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
	

    this.currentRound = 1;  // Initialize the current round, will be overwritten by the actual current round from hass
  }

  set hass(hass) {
    if (!this._hass || this._hass !== hass) {
      this._hass = hass;

      // Get the current round from the sensor's state attributes
	  const entityId = this.config.entity;
	  const state = this._hass.states[entityId];
	  if (state && state.attributes.current_round) {
		  const currentRoundFromState = state.attributes.current_round;
 
          // If this is the first time loading or if the user is at the current round,
          // set the current round to the one from the state
          if (!this.currentRoundSetByUser || this.currentRound === currentRoundFromState) {
              this.currentRound = currentRoundFromState;
              this.currentRoundSetByUser = false; // reset the user-set flag
          }
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
      const entityId = this.config.entity;
      const state = this._hass.states[entityId];
      if (!state) {
          return;
      }

      this.currentRound += direction;

      // If the current round is less than 1, reset it to 1 (or min round number)
      if (this.currentRound < 1) {
          this.currentRound = 1;
      }

      // Ensure that the round does not go above the maximum available rounds (optional)
      if (state.attributes.max_round && this.currentRound > state.attributes.max_round) {
          this.currentRound = state.attributes.max_round;
      }

      // Mark that the user has manually set the round
      this.currentRoundSetByUser = true;

      // Display the fixtures for the new round
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

		// Determine if the fixture has finished
		const fixtureDate = new Date(fixture.date);
		const now = new Date();
		const timeOrFT = fixtureDate < now ? 'FT' : fixtureDate.toLocaleTimeString('sv-SE', {
			hour: '2-digit',
			minute: '2-digit',
		});

        // Check if the fixture is related to Barcelona
        const isBarcelonaFixture = fixture.home_team === 'Barcelona' || fixture.away_team === 'Barcelona';

		// Determine if there is a winning team and style the score accordingly
		const homeScoreBold = fixture.score.home > fixture.score.away ? 'bold' : 'normal';
		const awayScoreBold = fixture.score.away > fixture.score.home ? 'bold' : 'normal';


		const homeTeamElement = document.createElement('div');
		homeTeamElement.className = 'team-container';
		homeTeamElement.innerHTML = `
			<div class="team">
				<img class="team-logo" src="${fixture.home_team_logo}" alt="${fixture.home_team} logo">
				<span class="${fixture.home_team === 'Barcelona' ? 'bold' : ''}">${fixture.home_team}</span>
			</div>
			<div class="score" style="font-weight: ${homeScoreBold};">
				${isBarcelonaFixture ? '<span class="spoiler">Click to reveal</span>' : fixture.score.home ?? '-'}
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
				<span class="${fixture.away_team === 'Barcelona' ? 'bold' : ''}">${fixture.away_team}</span>
			</div>
			<div class="score" style="font-weight: ${awayScoreBold};">
				${isBarcelonaFixture ? '<span class="spoiler">Click to reveal</span>' : fixture.score.away ?? '-'}
			</div>
			<div class="time-or-ft">
				${timeOrFT}
			</div>
		`;

        // Handle spoiler for Barcelona games
        if (isBarcelonaFixture) {
          const homeScore = homeTeamElement.querySelector('.score');
          const awayScore = awayTeamElement.querySelector('.score');

          homeScore.addEventListener('click', function(event) {
            event.stopPropagation();
            this.classList.add('revealed');
            this.textContent = `${fixture.score.home ?? '-'}`;
          });
          awayScore.addEventListener('click', function(event) {
            event.stopPropagation();
            this.classList.add('revealed');
            this.textContent = `${fixture.score.away ?? '-'}`;
          });

          // Make the Barcelona fixture clickable to show more info
          const clickHandler = () => {
            const event = new Event('hass-more-info', { bubbles: true, cancelable: false, composed: true });
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
  
  saveConfig() {
	const event = new Event('config-changed', {
	  bubbles: true,
	  composed: true,
	});
	event.detail = { config: this.config };
	this.dispatchEvent(event);
  }
  

  getCardSize() {
    return 3; // Size of your card, affects the height in the UI
  }
  
  static getConfigElement() {
      return document.createElement('football-fixture-card-editor');
  }

  static getStubConfig() {
      return {
          entity: '', // Default entity
          teamId: '', // Default team ID
          league: '', // Default league ID
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
    }

    setConfig(config) {
        this.config = config;
        this.render();
        this.populateEntities(); // Populate entities when the config is set
    }

    render() {
        if (!this.config) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <style>
                .form-group {
                    margin-bottom: 16px;
                }
                .form-group label {
                    display: block;
                    font-size: 14px;
                    margin-bottom: 4px;
                    color: var(--primary-text-color);
                }
                .form-group input,
                .form-group select {
                    width: 100%;
                    padding: 8px;
                    font-size: 14px;
                    border: 1px solid var(--primary-text-color);
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                .dropdown {
                    position: relative;
                    border: none;
                }
                .dropdown label {
                    display: block;
                    color: var(--secondary-text-color);
                    font-size: 14px;
                    margin-bottom: 4px;
                }
                .dropdown-input-wrapper:hover {
                    background-color: #ececec;
                }
                .dropdown-list {
                    position: absolute;
                    z-index: 3;
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    background: white;
                    border: 1px solid #818181;
                    border-radius: 4px;
                    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.2);
                    width: 100%;
                    max-height: 200px;
                    overflow-y: auto;
                    display: none; /* Hidden by default */
                }
                .dropdown-list li {
                    padding: 8px;
                    cursor: pointer;
                }
                .dropdown-list li:hover {
                    background-color: #f0f0f0;
                }
            </style>
            <div class="form-group dropdown">
                <label for="entity">Entity*</label>
                <div class="dropdown-input-wrapper">
                    <input type="text" id="entity-input" placeholder="Select an option">
                </div>
                <ul class="dropdown-list" id="entity-list"></ul>
            </div>
            <div class="form-group">
                <label for="team-id">Team ID</label>
                <input id="team-id" type="number" value="${this.config.teamId || ''}">
            </div>
            <div class="form-group">
                <label for="league">League</label>
                <input id="league" type="number" value="${this.config.league || ''}">
            </div>
        `;

        this.entityInput = this.shadowRoot.querySelector('#entity-input');
        this.entityList = this.shadowRoot.querySelector('#entity-list');

        this.entityInput.addEventListener('click', () => {
            this.entityList.style.display = this.entityList.style.display === 'block' ? 'none' : 'block';
        });

        this.shadowRoot.querySelector('#team-id').addEventListener('change', (e) => {
            this.config.teamId = Number(e.target.value);
            this._saveConfig();
        });

        this.shadowRoot.querySelector('#league').addEventListener('change', (e) => {
            this.config.league = Number(e.target.value);
            this._saveConfig();
        });

        // Handle outside click to close the dropdowns
        document.addEventListener('click', (event) => {
            if (!this.shadowRoot.contains(event.target)) {
                this.entityList.style.display = 'none'; // Close entity dropdown list
            }
        }, true);
    }

	populateEntities() {
		if (!this._hass) {
			console.warn("Hass is not defined.");
			return;
		}

		try {
			const entities = Object.keys(this._hass.states)
				.filter(entityId => entityId.startsWith('sensor.') || entityId.startsWith('input_number.') || entityId.startsWith('automation.'))
				.map(entityId => ({
					entityId,
					friendlyName: this._hass.states[entityId].attributes.friendly_name || entityId
				}))
				.sort((a, b) => a.friendlyName.localeCompare(b.friendlyName));

			this.entityList.innerHTML = '';

			entities.forEach(({ entityId, friendlyName }) => {
				const listItem = document.createElement('li');
				listItem.textContent = friendlyName;
				listItem.addEventListener('click', () => {
					this.setEntity(entityId);
				});
				this.entityList.appendChild(listItem);
			});

			// Set initial value if one is already configured
			if (this.config.entity) {
				const selectedEntity = entities.find(entity => entity.entityId === this.config.entity);
				if (selectedEntity) {
					this.entityInput.value = selectedEntity.friendlyName;
				}
			}
		} catch (error) {
			console.error("Error populating entities:", error);
		}
	}

    setEntity(entityId) {
        const friendlyName = this._hass.states[entityId].attributes.friendly_name || entityId;
        this.entityInput.value = friendlyName;
        this.config.entity = entityId;
        this._saveConfig();
        this.entityList.style.display = 'none';
    }

    _saveConfig() {
        const event = new CustomEvent('config-changed', {
            detail: { config: this.config },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    set hass(hass) {
        this._hass = hass;
        this.populateEntities(); // Populate entities when hass is set
    }
}

customElements.define('football-fixture-card-editor', FootballFixtureCardEditor);

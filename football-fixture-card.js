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
	

    this.currentRound = null;  // Initialize the current round, will be overwritten by the actual current round from hass
  }

	set hass(hass) {
		this._hass = hass;

		// Get the current round from the sensor's state attributes
		const entityId = this.config.entity;
		const state = this._hass.states[entityId];
		if (state && state.attributes.current_round) {
			const currentRoundFromState = state.attributes.current_round;

			// Only update if it's the first load, the user has not manually set a round, or the state round is different
			if (this.currentRound === null || !this.currentRoundSetByUser || this.currentRound === currentRoundFromState) {
				this.currentRound = currentRoundFromState;
				this.currentRoundSetByUser = false; // reset the user-set flag
			}
		} else {
			this.currentRound = 1; // Default to Round 1 if no state is available
		}

		// Add event listeners only once
		if (!this.listenersAdded) {
			this.shadowRoot.getElementById('prev-round').addEventListener('click', () => this.changeRound(-1));
			this.shadowRoot.getElementById('next-round').addEventListener('click', () => this.changeRound(1));
			this.shadowRoot.getElementById('round-title').addEventListener('click', () => this.returnToCurrentRound());
			this.listenersAdded = true;  // Flag to prevent adding listeners multiple times
		}

		// Display the current round's fixtures
		this.displayFixtures(this.currentRound);
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
        this._entityInputValue = '';  // To store the current input value temporarily
        this._entitySelected = false; // To track whether an entity has been selected
    }

    setConfig(config) {
        this.config = { ...config };  // Clone the config object
        this._entityInputValue = this.config.entity || '';  // Initialize with the config's entity value

        this.render();
        this.populateEntities(); // Populate entities when the config is set

        // If there is already a selected entity, display it in the input field
        if (this._entityInputValue) {
            this.dropdownInput.value = this._hass.states[this._entityInputValue]?.attributes?.friendly_name || this._entityInputValue;
        }
    }

    render() {
        if (!this.config) return;

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
				<label for="team-id">Team ID</label>
				<input id="team-id" type="number" value="${this.config.teamId || ''}">
			</div>
			<div class="input-container">
				<label for="league">League</label>
				<input id="league" type="number" value="${this.config.league || ''}">
			</div>
        `;

		this.dropdownInput = this.shadowRoot.querySelector('#dropdown-input');
		this.entityList = this.shadowRoot.querySelector('#entity-list');

		// Event listeners
		this.dropdownInput.addEventListener('input', (e) => this.handleInput(e));

        this.dropdownInput.addEventListener('focus', () => {
            // Show the dropdown list when the input field is focused
            this.entityList.style.display = 'block';
        });

        // Handle outside clicks to close the dropdowns
        document.addEventListener('click', (event) => {
            if (!this.shadowRoot.contains(event.target)) {
                this.entityList.style.display = 'none';
            }
        }, true);
    }

	
	handleInput(e) {
		const searchTerm = e.target.value.trim().toLowerCase();

		if (searchTerm === this._entityInputValue.trim().toLowerCase()) {
			return;
		}

		this._entityInputValue = searchTerm;
		this.filterEntities(this._entityInputValue);
	}
	
	

    populateEntities() {
        if (!this._hass || !this.config || !this.entityList) return;

        const entities = Object.keys(this._hass.states)
            .filter(entityId => entityId.startsWith('sensor.') || entityId.startsWith('input_number.') || entityId.startsWith('automation.'))
            .map(entityId => {
                return {
                    entityId: entityId,
                    friendlyName: this._hass.states[entityId].attributes.friendly_name || entityId
                };
            });

        entities.sort((a, b) => a.friendlyName.localeCompare(b.friendlyName));

        this.allEntities = entities; // Store all entities for filtering
        this.filteredEntities = [...entities]; // Initialize with all entities

        this.updateEntityList();
    }


	filterEntities(searchTerm) {
		const filteredEntities = this.allEntities.filter(entity =>
			entity.friendlyName.toLowerCase().includes(searchTerm) ||
			entity.entityId.toLowerCase().includes(searchTerm)
		);

		if (JSON.stringify(filteredEntities) !== JSON.stringify(this.filteredEntities)) {
			this.filteredEntities = filteredEntities;
			this.updateEntityList();
		}
	}

	updateEntityList() {
		this.entityList.innerHTML = '';
		
		// If there are filtered entities, populate the list
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

			// Show the dropdown if there are results
			this.entityList.style.display = 'block';
		} else {
			// Hide the dropdown if no results match
			this.entityList.style.display = 'none';
		}
	}



    setEntity(entityId) {
        const friendlyName = this._hass.states[entityId]?.attributes?.friendly_name || entityId;
        this.dropdownInput.value = friendlyName; // Set the friendly name in the input
        this.config.entity = entityId;
        this.dispatchEvent(new CustomEvent('config-changed', { 
            bubbles: true, 
            composed: true, 
            detail: { config: this.config }
        }));
        this.entityList.style.display = 'none'; // Close the dropdown after selecting an entity
    }

    set hass(hass) {
        this._hass = hass;
        this.populateEntities();
    }
}

customElements.define('football-fixture-card-editor', FootballFixtureCardEditor);

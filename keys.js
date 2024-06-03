const Database = require("./database.js");

class Keys {
	#database;
	constructor(database = new Database()) {
		this.#database = database;
	}

	saveKey(roomID, messageID, key, recipientID) {
		this.#database.saveKey(roomID, messageID, key, recipientID);
	}

	saveKeys(roomID, messageID, keys) {
		keys.forEach((key) => {
			this.saveKey(roomID, messageID, key.key, key.ID);
		});
	}
}

module.exports = Keys;

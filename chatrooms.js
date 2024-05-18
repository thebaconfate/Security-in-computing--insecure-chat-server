const Database = require("./database.js");

class Chatrooms {
	#database;
	constructor(database = new Database()) {
		this.#database = database;
	}

	getRoom(userID, roomID, callback) {
		this.#database.getChatroom(userID, roomID, callback);
	}
}

module.exports = Chatrooms;

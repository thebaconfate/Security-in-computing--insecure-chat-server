const Database = require("./database.js");

class Room {
	#database;
	roomID;
	constructor(roomID, database = new Database()) {
		this.#database = database;
		this.roomID = roomID;
	}

	getRoom(userID, callback) {
		this.#database.getRoom(userID, this.roomID, callback);
	}

	sendMessage(userID, message, callback) {
		this.#database.sendMessageToRoom(this.roomID, userID, message, callback);
	}
}

module.exports = Room;

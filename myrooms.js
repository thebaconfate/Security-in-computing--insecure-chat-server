const Database = require("./database.js");

class Rooms {
	#database;
	constructor(database = new Database()) {
		this.#database = database;
	}

	getRoom(roomID, userID, callback) {
		this.#database.getRoom(roomID, userID, callback);
	}

	sendMessage(roomID, userID, message, callback) {
		this.#database.sendMessageToRoom(roomID, userID, message, callback);
	}

	createDirectRoom(userID, otherUserId, callback) {
		this.#database.createDirectRoom(userID, otherUserId, callback);
	}

	getDirectRoom(userID, otherUserId, callback) {
		this.#database.getDirectRoom(userID, otherUserId, (err, room) => {
			if (err || room) {
				console.log("room", room);
				callback(err, room);
			} else {
				this.#database.createDirectRoom(userID, otherUserId, (err, lastID) => {
					if (err) callback(err, room);
					else this.#database.getDirectRoomByID(lastID, callback);
				});
			}
		});
	}

	createRoom(name, description, isPrivate, callback) {
		this.#database.createRoom(name, description, isPrivate, (err, lastID) => {
			if (err) callback(err, null);
			else this.#database.getRoomByID(lastID, callback);
		});
	}

	getPublicRooms(callback) {
		this.#database.getPublicRooms(callback);
	}
}

module.exports = Rooms;

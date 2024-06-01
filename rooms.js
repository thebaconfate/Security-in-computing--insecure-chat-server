const Database = require("./database.js");

class Rooms {
	#database;
	constructor(database = new Database()) {
		this.#database = database;
	}

	getRoom(roomID, userID, callback) {
		this.#database.getRoom(roomID, userID, (err, room) => {
			if (room)
				room.history = room.history.map((msg) => {
					msg.content = msg.content.toString("utf-8");
					return msg;
				});
			console.log(room);
			callback(err, room);
		});
	}

	sendMessage(roomID, userID, message, callback) {
		this.#database.sendMessageToRoom(
			roomID,
			userID,
			Buffer.from(message, "utf-8"),
			(err, message) => {
				if (message) message.content = message.content.toString("utf-8");
				callback(err, message);
			}
		);
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

	addUserToPublicChannel(userID, roomID, callback) {
		this.#database.addUserToPublicChannel(userID, roomID, (err) => {
			if (err) callback(err, null);
			else {
				console.log("added user to channel, getting room");
				this.#database.getRoom(roomID, userID, callback);
			}
		});
	}

	addUserToChannel(username, channelID, callback) {
		this.#database.getUserByUsername(username, (err, user) => {
			if (err || !user) callback("User not found", null, null);
			else {
				this.#database.addUserToChannel(user.ID, channelID, (err) => {
					if (err) callback(err, null, null);
					else
						this.#database.getRoom(channelID, user.ID, (err, room) => {
							callback(err, user.ID, room);
						});
				});
			}
		});
	}

	removeUserFromChannel(userID, roomID, callback) {
		this.#database.removeUserFromChannel(userID, roomID, callback);
	}

	getMembers(roomID, callback) {
		this.#database.getMembersCount(roomID, callback);
	}
}

module.exports = Rooms;

const sqlite = require("sqlite3").verbose();
class Database {
	#db;
	constructor() {
		this.#db = new sqlite.Database("./database.db", (err) => {
			if (err) {
				console.error("Error opening database:", err.message);
			} else {
				console.log("Connected to the database.");
			}
		});
	}

	#makeFinalizeQueries(queries) {
		return (callback) => {
			queries.forEach((query) => query.finalize());
			callback();
		};
	}

	registerUser(username, password, publicKey, callback) {
		const query = this.#db.prepare(
			"INSERT INTO users (username, password, public_key) VALUES (?, ?, ?)"
		);
		const registerGeneral = this.#db.prepare(
			"INSERT INTO members (user_ID, room_ID) VALUES (?, 1)"
		);
		const registerRandom = this.#db.prepare(
			"INSERT INTO members (user_ID, room_ID) VALUES (?, 2)"
		);
		const registerPrivate = this.#db.prepare(
			"INSERT INTO members (user_ID, room_ID) VALUES (?, 3)"
		);
		const finalize = this.#makeFinalizeQueries([
			query,
			registerGeneral,
			registerRandom,
			registerPrivate,
		]);
		query.run([username, password, publicKey], function (err) {
			if (err) callback(err);
			const userID = this.lastID;
			registerGeneral.run([userID]);
			registerRandom.run([userID]);
			registerPrivate.run([userID]);
			finalize(() => callback(err));
		});
	}

	getUserByUsername(username, callback) {
		const query = this.#db.prepare("SELECT * FROM users WHERE username = ?");
		query.get([username], callback);
		query.finalize();
	}

	getUserByID(userID, callback) {
		const query = this.#db.prepare("SELECT * FROM users WHERE ID = ?");
		query.get([userID], function (err, row) {
			query.finalize();
			callback(err, row);
		});
	}

	getUserData(userID, callback) {
		const userListQuery = this.#db.prepare(
			"SELECT ID, username, active FROM users where ID != ? ORDER BY ID"
		);
		const chatRoomListQuery = this.#db.prepare(
			"SELECT rooms.ID, rooms.name, rooms.private, rooms.direct FROM rooms INNER JOIN members ON rooms.ID = members.room_ID AND members.user_ID = ? ORDER BY rooms.ID"
		);
		const finalize = this.#makeFinalizeQueries([
			userListQuery,
			chatRoomListQuery,
		]);
		const getAllPublicRooms = (acc, callback) => {
			this.getPublicRooms((err, rooms) => {
				if (err) callback(err, null);
				else {
					acc.publicChannels = rooms;
					callback(err, acc);
				}
			});
		};

		userListQuery.all([userID], function (err, users) {
			if (err) finalize(() => callback(err, users));
			else
				chatRoomListQuery.all([userID], function (err, rooms) {
					if (err) finalize(() => callback(err, rooms));
					else
						finalize(() =>
							getAllPublicRooms({ users: users, rooms: rooms }, callback)
						);
				});
		});
	}

	setUserActiveState(userID, active, callback) {
		const query = this.#db.prepare("UPDATE users SET active = ? WHERE ID = ?");
		query.run([active, userID], function (err) {
			query.finalize();
			callback(err);
		});
	}

	getMembersCount(roomID, callback) {
		const query = this.#db.prepare(
			"SELECT DISTINCT users.username FROM members LEFT JOIN users ON members.user_ID = users.ID WHERE room_ID = ?"
		);
		query.all([roomID], function (err, rows) {
			if (rows)
				rows = rows.map((row) => {
					return row.username;
				});
			callback(err, rows);
		});
		query.finalize();
	}

	getChatroomMessages(roomID, callback) {
		const query = this.#db.prepare(
			"SELECT messages.ID, messages.sender_ID, users.username, messages.content, messages.timestamp FROM messages INNER JOIN rooms ON messages.room_ID = rooms.ID LEFT JOIN users ON messages.sender_ID = users.ID WHERE rooms.ID = ? ORDER BY messages.timestamp"
		);
		query.all([roomID], callback);
		query.finalize();
	}

	getRoom(roomID, userID, callback) {
		const chatroom = this.#db.prepare(
			"SELECT rooms.ID, rooms.name, rooms.description, rooms.private, rooms.direct FROM rooms LEFT JOIN members ON rooms.ID = members.room_ID WHERE members.room_ID = ? AND members.user_ID = ?"
		);
		const preCallback = (err, messages, room) => {
			if (err || !messages) callback(err, messages);
			else {
				room.history = messages;
				callback(err, room);
			}
		};
		const getMembersCountCallback = (err, count, room) => {
			if (err || !count) callback(err, count);
			else {
				room.members = count;
				this.getChatroomMessages(room.ID, function (err, messages) {
					preCallback(err, messages, room);
				});
			}
		};
		const getRoomCallback = (err, room) => {
			if (err || !room) callback(err, room);
			else
				this.getMembersCount(room.ID, function (err, count) {
					getMembersCountCallback(err, count, room);
				});
		};
		chatroom.get([roomID, userID], function (err, room) {
			getRoomCallback(err, room);
		});
	}

	getDirectRoom(userID, otherUserID, callback) {
		const query = this.#db.prepare(
			"SELECT rooms.ID, rooms.name, rooms.private, rooms.direct FROM rooms WHERE rooms.direct = TRUE AND rooms.ID IN (SELECT room_ID FROM members WHERE user_ID = ? INTERSECT SELECT room_ID FROM members WHERE user_ID = ?)"
		);
		query.get([userID, otherUserID], function (err, room) {
			callback(err, room);
		});
		query.finalize();
	}

	getDirectRoomByID(roomID, callback) {
		const query = this.#db.prepare(
			"SELECT rooms.ID, rooms.name, rooms.description, rooms.private, rooms.direct FROM rooms WHERE rooms.direct = TRUE AND rooms.ID = ?"
		);
		query.get([roomID], function (err, room) {
			callback(err, room);
		});
		query.finalize();
	}

	createDirectRoom(userID, otherUserID, callback) {
		const createRoomQuery = this.#db.prepare(
			"INSERT INTO rooms (name, description, private, direct) VALUES (?, ?, 1, 1)"
		);
		const name = "Direct room";
		const description = "Direct room";
		const insertCallback = (lastID) => {
			const insertMemberQuery = this.#db.prepare(
				"INSERT INTO members (user_ID, room_ID) VALUES (?, ?)"
			);
			insertMemberQuery.run([userID, lastID]);
			insertMemberQuery.run([otherUserID, lastID]);
			insertMemberQuery.finalize();
			callback(null, lastID);
		};
		createRoomQuery.run([name, description], function (err) {
			const roomID = this.lastID;
			if (err) callback(err, null);
			else insertCallback(roomID);
		});
	}

	sendMessageToRoom(roomID, senderID, messageContent, callback) {
		const query = this.#db.prepare(
			"INSERT INTO messages (room_ID, sender_ID, content) VALUES (?, ?, ?)"
		);
		const insertCallback = (lastID) => {
			this.getMessageByID(lastID, callback);
		};
		query.run([roomID, senderID, messageContent], function (err) {
			if (err) callback(err, null);
			else {
				insertCallback(this.lastID);
			}
		});
		query.finalize();
	}

	getMessageByID(messageID, callback) {
		const query = this.#db.prepare(
			"SELECT messages.ID, messages.room_ID as roomID, messages.sender_ID as senderID, users.username, messages.content, messages.timestamp, rooms.direct FROM messages INNER JOIN users ON messages.sender_ID = users.ID LEFT JOIN rooms ON messages.room_ID = rooms.ID WHERE messages.ID = ?"
		);
		query.get([messageID], callback);
		query.finalize();
	}

	createRoom(name, description, isprivate, callback) {
		const query = this.#db.prepare(
			"INSERT INTO rooms (name, description, private) VALUES (?, ?, ?)"
		);
		query.run([name, description, isprivate], function (err) {
			callback(err, this.lastID);
		});
	}

	getRoomByID(roomID, callback) {
		const query = this.#db.prepare("SELECT * FROM rooms WHERE ID = ?");
		const getMembersCallback = (err, room) => {
			if (err || !room) callback(err, room);
			else
				this.getChatroomMessages(roomID, function (err, messages) {
					if (err) callback(err, messages);
					else {
						room.history = messages;
						callback(err, room);
					}
				});
		};
		const getRoomCallback = (err, room) => {
			if (err || !room) callback(err, room);
			else
				this.getMembersCount(roomID, function (err, count) {
					if (err) callback(err, count);
					else {
						room.members = count;
						getMembersCallback(err, room);
					}
				});
		};
		query.get([roomID], function (err, room) {
			getRoomCallback(err, room);
		});
		query.finalize();
	}

	addUserToChannel(userID, roomID, callback) {
		const query = this.#db.prepare(
			"INSERT INTO members (user_ID, room_ID) VALUES (?, ?)"
		);
		query.run([userID, roomID], function (err) {
			callback(err);
		});
		query.finalize();
	}

	getPublicRooms(callback) {
		const query = this.#db.prepare(
			"SELECT rooms.ID, rooms.name, rooms.description, rooms.private, rooms.direct FROM rooms WHERE rooms.private = FALSE ORDER BY rooms.ID"
		);
		query.all(function (err, rows) {
			callback(err, rows);
		});
	}

	addUserToPublicChannel(userID, roomID, callback) {
		this.getRoomByID(roomID, (err, room) => {
			if (err || !room) callback(err, room);
			else if (room.private) callback("Room is private", null);
			else {
				this.addUserToChannel(userID, roomID, callback);
			}
		});
	}

	removeUserFromChannel(userID, roomID, callback) {
		const query = this.#db.prepare(
			"DELETE FROM members WHERE user_ID = ? AND room_ID = ?"
		);
		query.run([userID, roomID], function (err) {
			callback(err);
		});
		query.finalize();
	}
}

module.exports = Database;

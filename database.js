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

	registerUser(username, password, callback) {
		const query = this.#db.prepare(
			"INSERT INTO users (username, password) VALUES (?, ?)"
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
		query.run([username, password], function (err) {
			if (err) callback(err);
			const userID = this.lastID;
			console.log("User ID:", userID);
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
		query.get([userID], callback);
		query.finalize();
	}

	getUserData(userID, callback) {
		const userListQuery = this.#db.prepare(
			"SELECT ID, username, active FROM users where ID != ? ORDER BY ID"
		);
		const chatRoomListQuery = this.#db.prepare(
			"SELECT rooms.ID, rooms.name, rooms.private FROM rooms INNER JOIN members ON rooms.ID = members.room_ID AND members.user_ID = ? ORDER BY rooms.ID"
		);
		const finalize = this.#makeFinalizeQueries([
			userListQuery,
			chatRoomListQuery,
		]);
		userListQuery.all([userID], function (err, users) {
			if (err) finalize(() => callback(err, users));
			else
				chatRoomListQuery.all([userID], function (err, rooms) {
					if (err) finalize(() => callback(err, rooms));
					else finalize(() => callback(err, { users: users, rooms: rooms }));
				});
		});
	}

	setUserActiveState(userID, active, callback) {
		const query = this.#db.prepare("UPDATE users SET active = ? WHERE ID = ?");
		query.run([active, userID], callback);
		query.finalize();
	}

	getChatmembersCount(roomID, callback) {
		const query = this.#db.prepare(
			"SELECT COUNT(DISTINCT user_ID) as members FROM members WHERE room_ID = ?"
		);
		query.get([roomID], callback);
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
		const getChatmembersCountCallback = (err, count, room) => {
			if (err || !count) callback(err, count);
			else {
				room.members = count.members;
				console.log("room", room);
				this.getChatroomMessages(room.ID, function (err, messages) {
					preCallback(err, messages, room);
				});
			}
		};
		const getRoomCallback = (err, room) => {
			if (err || !room) callback(err, room);
			else
				this.getChatmembersCount(room.ID, function (err, count) {
					getChatmembersCountCallback(err, count, room);
				});
		};
		chatroom.get([roomID, userID], function (err, room) {
			console.log("room", room);
			getRoomCallback(err, room);
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
			"SELECT messages.ID, messages.room_ID as roomID, messages.sender_ID as senderID, users.username, messages.content, messages.timestamp FROM messages INNER JOIN users ON messages.sender_ID = users.ID WHERE messages.ID = ?"
		);
		query.get([messageID], callback);
		query.finalize();
	}
}

module.exports = Database;

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
			"INSERT INTO chatmembers (user_ID, room_ID) VALUES (?, 1)"
		);
		const registerRandom = this.#db.prepare(
			"INSERT INTO chatmembers (user_ID, room_ID) VALUES (?, 2)"
		);
		const registerPrivate = this.#db.prepare(
			"INSERT INTO chatmembers (user_ID, room_ID) VALUES (?, 3)"
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

	getUser(username, callback) {
		const query = this.#db.prepare("SELECT * FROM users WHERE username = ?");
		query.get([username], callback);
		query.finalize();
	}

	getUsers(usernames, callback) {
		const query = this.#db.prepare("SELECT * FROM users WHERE username IN (?)");
		query.all([usernames], callback);
		query.finalize();
	}

	getUserById(id, callback) {
		const query = this.#db.prepare("SELECT * FROM users WHERE ID = ?");
		query.get([id], callback);
		query.finalize();
	}

	getUserData(userID, username, callback) {
		const userListQuery = this.#db.prepare(
			"SELECT ID, username FROM users where ID != ? AND username != ?"
		);
		const chatRoomListQuery = this.#db.prepare(
			"SELECT chatrooms.ID, chatrooms.name, chatrooms.private FROM chatrooms INNER JOIN chatmembers ON chatrooms.ID = chatmembers.room_ID AND chatmembers.user_ID = ? ORDER BY chatrooms.ID"
		);
		const finalize = this.#makeFinalizeQueries([
			userListQuery,
			chatRoomListQuery,
		]);
		userListQuery.all([userID, username], function (err, users) {
			if (err) finalize(() => callback(err, users));
			else
				chatRoomListQuery.all([userID], function (err, chatRooms) {
					if (err) finalize(() => callback(err, chatRooms));
					else
						finalize(() =>
							callback(err, { directChats: users, chatRooms: chatRooms })
						);
				});
		});
	}

	createChatroom(name, description, isPrivate, callback) {
		const query = this.#db.prepare(
			"INSERT INTO chatrooms (name, description, private) VALUES (?, ?, ?)"
		);
		query.run([name, description, isPrivate], callback);
		query.finalize();
	}

	getChatroomByName(name, callback) {
		const query = this.#db.prepare("SELECT * FROM chatrooms WHERE name = ?");
		query.get([name], callback);
		query.finalize();
	}

	getChatroomById(id, callback) {
		const query = this.#db.prepare("SELECT * FROM chatrooms WHERE ID = ?");
		query.get([id], callback);
		query.finalize();
	}

	registerMemberToChatroom(userId, chatroomId, callback) {
		const query = this.#db.prepare(
			"INSERT INTO chatroom_members (user_id, chatroom_id) VALUES (?, ?)"
		);
		query.run([userId, chatroomId], callback);
		query.finalize();
	}
}

module.exports = Database;

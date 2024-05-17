/* 
This file is only to be used for initializing the database
! NOTE: Normally I'd use a hosted database like MySQL or PostgreSQL, but for the sake of simplicity I'm using SQLite
 */
const bcrypt = require("bcrypt");
const sqlite = require("sqlite3").verbose();
const db = new sqlite.Database("./database.db", (err) => {
	if (err) {
		console.error("Error opening database:", err.message);
	} else {
		console.log("Connected to the database.");
	}
});

db.serialize(() => {
	/*Creates the users table*/
	db.run(
		"CREATE TABLE IF NOT EXISTS users (ID INTEGER PRIMARY KEY AUTOINCREMENT, username VARCHAR(255) NOT NULL UNIQUE, password BLOB NOT NULL)"
	);
	const password = bcrypt.hashSync("admin", 10);
	db.run(
		`INSERT OR IGNORE INTO users (ID, username, password) VALUES (1, 'admin', '${password}')`
	);
});

db.serialize(() => {
	// Creates the chatrooms table
	db.run(
		"CREATE TABLE IF NOT EXISTS chatrooms (ID INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255) NOT NULL, description VARCHAR(255), private BOOLEAN NOT NULL DEFAULT FALSE)"
	);
	db.run(
		"INSERT OR IGNORE INTO chatrooms (ID, name, description, private) VALUES (1, 'General', 'General chatroom', FALSE)"
	);
	db.run(
		"INSERT OR IGNORE INTO chatrooms (ID, name, description, private) VALUES (2, 'Random', 'Random chatroom', FALSE)"
	);
	db.run(
		"INSERT OR IGNORE INTO chatrooms (ID, name, description, private) VALUES (3, 'Private', 'Private chatroom', TRUE)"
	);
});

db.serialize(() => {
	// Creates the chatmembers table, this is a many to many table between users and chatrooms. It connects users to chatrooms
	db.run(
		"CREATE TABLE IF NOT EXISTS chatmembers (user_ID INTEGER NOT NULL, room_ID INTEGER NOT NULL, FOREIGN KEY(user_ID) REFERENCES users(ID), FOREIGN KEY(room_ID) REFERENCES chatrooms(ID))"
	);
	db.run("INSERT OR IGNORE INTO chatmembers (user_ID, room_ID) VALUES (1, 1)");
});

db.serialize(() => {
	// Creates the chatmessages table, this stores the messages sent in chatrooms
	db.run(
		"CREATE TABLE IF NOT EXISTS chatmessages (ID INTEGER PRIMARY KEY AUTOINCREMENT, room_ID INTEGER NOT NULL, sender_ID INTEGER NOT NULL, content TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(room_ID) REFERENCES chatrooms(ID), FOREIGN KEY(sender_ID) REFERENCES users(ID))"
	);
});

db.serialize(() => {
	db.run(
		"CREATE TABLE IF NOT EXISTS directmessages (ID INTEGER PRIMARY KEY AUTOINCREMENT, sender_ID INTEGER NOT NULL, receiver_ID INTEGER NOT NULL, content TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(sender_ID) REFERENCES users(ID), FOREIGN KEY(receiver_ID) REFERENCES users(ID))"
	);
});

db.close();

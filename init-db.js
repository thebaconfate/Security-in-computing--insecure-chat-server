/* 
This file is only to be used for initializing the database
! NOTE: Normally I'd use a hosted database like MySQL or PostgreSQL, but for the sake of simplicity I'm using SQLite
 */
const bcrypt = require("bcrypt");
const sqlite = require("sqlite3").verbose();
const db = new sqlite.Database("./database.db", (err) => {
	if (err) console.error("Error opening database:", err.message);
});

db.serialize(() => {
	/*Creates the users table*/
	db.run(
		"CREATE TABLE IF NOT EXISTS users (ID INTEGER PRIMARY KEY AUTOINCREMENT, username VARCHAR(255) NOT NULL UNIQUE, password BLOB NOT NULL, active BOOLEAN NOT NULL DEFAULT FALSE, public_key BLOB NOT NULL)"
	);
});

db.serialize(() => {
	// Creates the rooms table
	db.run(
		"CREATE TABLE IF NOT EXISTS rooms (ID INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255) NOT NULL, description VARCHAR(255), private BOOLEAN NOT NULL DEFAULT FALSE, direct BOOLEAN NOT NULL DEFAULT FALSE)"
	);
	db.run(
		"INSERT OR IGNORE INTO rooms (ID, name, description) VALUES (1, 'General', 'General room')"
	);
	db.run(
		"INSERT OR IGNORE INTO rooms (ID, name, description) VALUES (2, 'Random', 'Random room')"
	);
	db.run(
		"INSERT OR IGNORE INTO rooms (ID, name, description, private) VALUES (3, 'Private', 'Private room', TRUE)"
	);
});

db.serialize(() => {
	// Creates the members table, this is a many to many table between users and rooms. It connects users to rooms
	db.run(
		"CREATE TABLE IF NOT EXISTS members (user_ID INTEGER NOT NULL, room_ID INTEGER NOT NULL, FOREIGN KEY(user_ID) REFERENCES users(ID), FOREIGN KEY(room_ID) REFERENCES rooms(ID))"
	);
	db.run(
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_membership ON members (user_ID, room_ID)"
	);
});

db.serialize(() => {
	// Creates the chatmessages table, this stores the messages sent in rooms
	db.run(
		"CREATE TABLE IF NOT EXISTS messages (ID INTEGER PRIMARY KEY AUTOINCREMENT, room_ID INTEGER NOT NULL, sender_ID INTEGER NOT NULL, content BLOB NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(room_ID) REFERENCES rooms(ID), FOREIGN KEY(sender_ID) REFERENCES users(ID))"
	);
});

db.serialize(() => {
	db.run(
		"CREATE TABLE IF NOT EXISTS keys (room_ID INTEGER NOT NULL, message_ID INTEGER NOT NULL, key BLOB NOT NULL, recipient_ID INTEGER NOT NULL, FOREIGN KEY(room_ID) REFERENCES rooms(ID), FOREIGN KEY(message_ID) REFERENCES messages(ID), FOREIGN KEY(recipient_ID) REFERENCES users(ID))"
	);
});

db.close();

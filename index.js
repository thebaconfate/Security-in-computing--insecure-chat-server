// Setup basic express server
require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const port = process.env.PORT || 3000;
const Database = require("./database.js");
const database = new Database();
const Rooms = require("./myrooms.js");
const OldRooms = require("./rooms.js");
const User = require("./myusers.js");
const OldUsers = require("./users.js").Users;
const Auth = require("./auth.js");

// Load application config/state
require("./basicstate.js").setup(OldUsers, OldRooms);

server.listen(port, () => {
	console.log("Server listening on port %d", port);
});

////////////////////////////
// Authentication helpers //
////////////////////////////

/**
 *
 * @param {string} username - The username of the user to create
 * @param {string} password - The password of the user to create
 * @param {Function} callback - The callback function to call when the user is created, or an error is encountered
 */
function createUser(username, password, callback) {
	const auth = new Auth(database);
	auth.registerUser(username, password, (err) => {
		if (err) {
			callback({ success: false, reason: "User already exists" });
		} else {
			callback({ success: true });
		}
	});
}

/**
 *
 * @param {string} username - The username of the user to authenticate
 * @param {string} password - The password of the user to authenticate
 * @param {Function} callback - The callback function to call when the user is authenticated, or an error is encountered
 */
function authenticateUser(username, password, callback) {
	const auth = new Auth(database);
	auth.authenticateUser(username, password, (err, user) => {
		if (err || !user)
			callback({ success: false, reason: "Invalid username or password" });
		else
			auth.generateJWT(user.ID, user.username, (err, token) => {
				if (err) callback({ success: false, reason: "Error generating token" });
				else callback({ success: true, token: token });
			});
	});
}

/**
 *
 * @param {Function} callback - The callback function to call when the token is missing
 */
function missingToken(callback) {
	callback({ success: false, reason: "Missing token" }, null);
}

/**
 *
 * @param {Function} callback - The callback function to call when the token is invalid
 */
function invalidToken(callback) {
	callback({ success: false, reason: "Invalid token" }, null);
}

/**
 *
 * @param {string} token - The token to authenticate
 * @param {Function} callback - The callback function to call when the token is authenticated, or an error is encountered
 */
function authenticateToken(token, callback) {
	if (!token) missingToken(callback);
	const auth = new Auth(database);
	auth.verifyJWT(token, (err, decodedToken) => {
		if (err) invalidToken(callback);
		else callback(null, decodedToken);
	});
}

//////////////////////////
// User state functions //
//////////////////////////

/**
 *
 * @param {socket} socket - The socket to broadcast the user state change to
 * @param {number} userID - The ID of the user
 * @param {boolean} state - The state of the user
 */
function setUserState(socket, userID, state) {
	const users = new User(userID, database);
	users.setState(state, (err) => {
		if (!err) {
			socket.broadcast.emit("user_state_change", {
				ID: userID,
				active: state,
			});
		}
	});
}

///////////////////////////////
// Chatroom helper functions //
///////////////////////////////

function sendToRoomOLD(room, event, data) {
	io.to("room" + room.getId()).emit(event, data);
}

function sendToRoom(roomID, event, data) {
	io.to(`room${roomID}`).emit(event, data);
}

function newRoom(name, user, options) {
	const room = OldRooms.addRoom(name, options);
	addUserToRoom(user, room);
	return room;
}

function newChannel(name, description, private, user) {
	return newRoom(name, user, {
		description: description,
		private: private,
	});
}

function newDirectRoom(user_a, user_b) {
	const room = OldRooms.addRoom(`Direct-${user_a.name}-${user_b.name}`, {
		direct: true,
		private: true,
	});

	addUserToRoom(user_a, room);
	addUserToRoom(user_b, room);

	return room;
}

function getDirectRoom(user_a, user_b) {
	const rooms = OldRooms.getOldRooms().filter(
		(r) =>
			r.direct &&
			((r.members[0] == user_a.name && r.members[1] == user_b.name) ||
				(r.members[1] == user_a.name && r.members[0] == user_b.name))
	);

	if (rooms.length == 1) return rooms[0];
	else return newDirectRoom(user_a, user_b);
}

function addUserToRoom(user, room) {
	user.addSubscription(room);
	room.addMember(user);

	sendToRoomOLD(room, "update_user", {
		room: room.getId(),
		username: user,
		action: "added",
		members: room.getMembers(),
	});
}

function removeUserFromRoom(user, room) {
	user.removeSubscription(room);
	room.removeMember(user);

	sendToRoomOLD(room, "update_user", {
		room: room.getId(),
		username: user,
		action: "removed",
		members: room.getMembers(),
	});
}

function addMessageToRoom(message) {
	sendToRoom(message.roomID, "new message", message);
}

function setUserActiveStateOLD(socket, username, state) {
	const user = OldUsers.getUser(username);

	if (user) user.setActiveState(state);

	socket.broadcast.emit("user_state_change", {
		username: username,
		active: state,
	});
}

///////////////////////////
// IO connection handler //
///////////////////////////

const socketMap = {};

io.on("connection", (socket) => {
	let userLoggedIn = false;
	let username = false;

	console.log("New Connection");

	///////////////////////
	// user registration //
	///////////////////////

	socket.on("register", (credentials, callback) => {
		if (!credentials.username || !credentials.password) {
			callback({ success: false, reason: "Invalid username or password" });
			socket.disconnect(true);
		} else {
			createUser(credentials.username, credentials.password, (response) => {
				callback(response);
				socket.disconnect(true);
			});
		}
	});

	/////////////////////////
	// user authentication //
	/////////////////////////

	socket.on("authenticate", (credentials, callback) => {
		if (!credentials.username || !credentials.password) {
			callback({ success: false, reason: "Invalid username or password" });
			socket.disconnect(true);
		} else
			authenticateUser(credentials.username, credentials.password, (result) => {
				if (result.success) setUserState(socket, result.ID, true);
				callback(result);
			});
	});

	///////////////////
	// get-user-data //
	///////////////////

	/**
	 * @param {Object} data - The data object containing the token
	 * @param {Function} callback - The callback function to call when the user data is retrieved
	 * this is triggered when the client emits get-user-data.
	 * It authenticates the token, then retrieves the user data from the database and sends it back to the client.
	 * It retrieves, all the users, the public and private rooms but not the direct rooms.
	 */
	socket.on("get-user-data", (data, callback) => {
		authenticateToken(data.token, (err, decodedToken) => {
			if (err || !decodedToken) callback(err);
			else {
				const user = new User(decodedToken.ID, database);
				user.getUserData((err, data) => {
					if (err || !data) invalidToken(callback);
					else {
						const rooms = data.rooms.map((room) => {
							socket.join(`room${room.ID}`);
							return room;
						});
						data.rooms = rooms.filter((room) => !room.direct);
						console.log("get-user-data", data);
						callback({ success: true, data: data });
					}
				});
			}
		});
	});

	//////////////////////
	// incoming message //
	//////////////////////

	/**
	 * @param {Object} req - The request object containing the token and the message
	 * @param {Function} callback - The callback function to call when the message is sent
	 */
	socket.on("send-message", (req, callback) => {
		authenticateToken(req.token, (err, decodedToken) => {
			if (err) callback(err);
			if (!req.message?.room)
				callback({ success: false, reason: "No room supplied" });
			if (!req.message?.content)
				callback({ success: false, reason: "No message supplied" });
			const room = new Rooms(database);
			room.sendMessage(
				req.message.room,
				decodedToken.ID,
				req.message.content,
				(err, message) => {
					if (err) invalidToken(callback);
					else {
						addMessageToRoom(message);
						callback({ success: true });
					}
				}
			);
		});
	});

	///////////////////
	// get-room-data //
	///////////////////

	/**
	 * @param {Object} data - The data object containing the token and the room ID
	 * @param {Function} callback - The callback function to call when the room data is retrieved
	 */
	socket.on("get-room", (data, callback) => {
		authenticateToken(data.token, (err, decodedToken) => {
			if (err || !decodedToken) callback(err);
			const room = new Rooms(database);
			room.getRoom(data.room, decodedToken.ID, (err, room) => {
				if (err || !room) callback({ success: false, reason: "Invalid room" });
				else callback({ success: true, room: room });
			});
		});
	});

	/////////////////////////////
	// request for direct room //
	/////////////////////////////

	// TODO: Refactor this
	socket.on("request_direct_room", (req) => {
		if (!req.token || !req.to) missingToken(callback);
		const auth = new Auth(database);
		auth.verifyJWT(req.token, (err, decodedToken) => {
			if (err) invalidToken(callback);
			else {
				const rooms = new OldRooms(database);
				rooms.getDirectRoom(decodedToken.ID, req.to, (err, room) => {
					if (err) invalidToken(callback);
				});
			}
		});

		console.log("request_direct_room", req);

		if (userLoggedIn) {
			const user_a = OldUsers.getUser(req.to);
			const user_b = OldUsers.getUser(username);

			if (user_a && user_b) {
				const room = getDirectRoom(user_a, user_b);
				const roomCID = "room" + room.getId();
				socket.join(roomCID);
				if (socketMap[user_a.name]) socketMap[user_a.name].join(roomCID);

				socket.emit("update_room", {
					room: room,
					moveto: true,
				});
			}
		}
	});

	// TODO: Refactor this
	socket.on("add_channel", (req) => {
		console.log("add_channel", req);
		if (userLoggedIn) {
			const user = OldUsers.getUser(username);
			console.log(req);
			const room = newChannel(req.name, req.description, req.private, user);
			const roomCID = "room" + room.getId();
			socket.join(roomCID);

			socket.emit("update_room", {
				room: room,
				moveto: true,
			});

			if (!room.private) {
				const publicChannels = OldRooms.getOldRooms().filter(
					(r) => !r.direct && !r.private
				);
				socket.broadcast.emit("update_public_channels", {
					publicChannels: publicChannels,
				});
			}
		}
	});

	// TODO: Refactor this
	socket.on("join_channel", (req) => {
		console.log("join_channel", req);
		if (userLoggedIn) {
			const user = OldUsers.getUser(username);
			const room = OldRooms.getRoom(req.id);

			if (!room.direct && !room.private) {
				addUserToRoom(user, room);

				const roomCID = "room" + room.getId();
				socket.join(roomCID);

				socket.emit("update_room", {
					room: room,
					moveto: true,
				});
			}
		}
	});

	// TODO: Refactor this
	socket.on("add_user_to_channel", (req) => {
		console.log("add_user_to_channel", req);
		if (userLoggedIn) {
			const user = OldUsers.getUser(req.user);
			const room = OldRooms.getRoom(req.channel);

			if (!room.direct) {
				addUserToRoom(user, room);

				if (socketMap[user.name]) {
					const roomCID = "room" + room.getId();
					socketMap[user.name].join(roomCID);

					socketMap[user.name].emit("update_room", {
						room: room,
						moveto: false,
					});
				}
			}
		}
	});

	// TODO: Refactor this
	socket.on("leave_channel", (req) => {
		console.log("leave_channel", req);
		if (userLoggedIn) {
			const user = OldUsers.getUser(username);
			const room = OldRooms.getRoom(req.id);

			if (!room.direct && !room.forceMembership) {
				removeUserFromRoom(user, room);

				const roomCID = "room" + room.getId();
				socket.leave(roomCID);

				socket.emit("remove_room", {
					room: room.getId(),
				});
			}
		}
	});

	////////////////
	// reconnects //
	////////////////

	// TODO: Refactor this
	socket.on("reconnect", () => {
		console.log("reconnect");
		if (userLoggedIn) setUserActiveStateOLD(socket, username, true);
	});

	/////////////////
	// disconnects //
	/////////////////

	// TODO: Refactor this
	socket.on("disconnect", () => {
		console.log("disconnect");
		if (userLoggedIn) setUserActiveStateOLD(socket, username, false);
	});
});

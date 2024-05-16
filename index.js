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
const Rooms = require("./rooms.js");
const Users = require("./users.js");
const Auth = require("./auth.js");
const User = require("./user.js");

// Load application config/state
require("./basicstate.js").setup(Users, Rooms);

server.listen(port, () => {
	console.log("Server listening on port %d", port);
});

///////////////////////////////
// Chatroom helper functions //
///////////////////////////////

function sendToRoom(room, event, data) {
	io.to("room" + room.getId()).emit(event, data);
}

function newUser(name) {
	const user = Users.addUser(name);
	const rooms = Rooms.getForcedRooms();

	rooms.forEach((room) => {
		addUserToRoom(user, room);
	});

	return user;
}

function newRoom(name, user, options) {
	const room = Rooms.addRoom(name, options);
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
	const room = Rooms.addRoom(`Direct-${user_a.name}-${user_b.name}`, {
		direct: true,
		private: true,
	});

	addUserToRoom(user_a, room);
	addUserToRoom(user_b, room);

	return room;
}

function getDirectRoom(user_a, user_b) {
	const rooms = Rooms.getRooms().filter(
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

	sendToRoom(room, "update_user", {
		room: room.getId(),
		username: user,
		action: "added",
		members: room.getMembers(),
	});
}

function removeUserFromRoom(user, room) {
	user.removeSubscription(room);
	room.removeMember(user);

	sendToRoom(room, "update_user", {
		room: room.getId(),
		username: user,
		action: "removed",
		members: room.getMembers(),
	});
}

function addMessageToRoom(roomId, username, msg) {
	const room = Rooms.getRoom(roomId);

	msg.time = new Date().getTime();

	if (room) {
		sendToRoom(room, "new message", {
			username: username,
			message: msg.message,
			room: msg.room,
			time: msg.time,
			direct: room.direct,
		});

		room.addMessage(msg);
	}
}

function setUserActiveState(socket, username, state) {
	const user = Users.getUser(username);

	if (user) user.setActiveState(state);

	socket.broadcast.emit("user_state_change", {
		username: username,
		active: state,
	});
}

///////////////////////////
// IO connection handler //
///////////////////////////

const socketmap = {};

io.on("connection", (socket) => {
	let userLoggedIn = false;
	let username = false;

	console.log("New Connection");

	///////////////////////
	// incomming message //
	///////////////////////

	socket.on("new message", (msg) => {
		console.log("new message", msg);
		if (userLoggedIn) {
			console.log(msg);
			addMessageToRoom(msg.room, username, msg);
		}
	});

	/////////////////////////////
	// request for direct room //
	/////////////////////////////

	socket.on("request_direct_room", (req) => {
		console.log("request_direct_room", req);
		if (userLoggedIn) {
			const user_a = Users.getUser(req.to);
			const user_b = Users.getUser(username);

			if (user_a && user_b) {
				const room = getDirectRoom(user_a, user_b);
				const roomCID = "room" + room.getId();
				socket.join(roomCID);
				if (socketmap[user_a.name]) socketmap[user_a.name].join(roomCID);

				socket.emit("update_room", {
					room: room,
					moveto: true,
				});
			}
		}
	});

	socket.on("add_channel", (req) => {
		console.log("add_channel", req);
		if (userLoggedIn) {
			const user = Users.getUser(username);
			console.log(req);
			const room = newChannel(req.name, req.description, req.private, user);
			const roomCID = "room" + room.getId();
			socket.join(roomCID);

			socket.emit("update_room", {
				room: room,
				moveto: true,
			});

			if (!room.private) {
				const publicChannels = Rooms.getRooms().filter(
					(r) => !r.direct && !r.private
				);
				socket.broadcast.emit("update_public_channels", {
					publicChannels: publicChannels,
				});
			}
		}
	});

	socket.on("join_channel", (req) => {
		console.log("join_channel", req);
		if (userLoggedIn) {
			const user = Users.getUser(username);
			const room = Rooms.getRoom(req.id);

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

	socket.on("add_user_to_channel", (req) => {
		console.log("add_user_to_channel", req);
		if (userLoggedIn) {
			const user = Users.getUser(req.user);
			const room = Rooms.getRoom(req.channel);

			if (!room.direct) {
				addUserToRoom(user, room);

				if (socketmap[user.name]) {
					const roomCID = "room" + room.getId();
					socketmap[user.name].join(roomCID);

					socketmap[user.name].emit("update_room", {
						room: room,
						moveto: false,
					});
				}
			}
		}
	});

	socket.on("leave_channel", (req) => {
		console.log("leave_channel", req);
		if (userLoggedIn) {
			const user = Users.getUser(username);
			const room = Rooms.getRoom(req.id);

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
	///////////////////////
	// user registration //
	///////////////////////

	socket.on("register", (credentials, callback) => {
		console.log("received user registration request");
		if (!credentials.username || !credentials.password) {
			callback({ success: false, reason: "Invalid username or password" });
		} else {
			const auth = new Auth(database);
			auth.registerUser(
				credentials.username,
				credentials.password,
				function (err) {
					if (err) {
						console.log("Failed registration", err.code);
						callback({ success: false, reason: "User already exists" });
					} else {
						console.log("Successful registration");
						callback({ success: true });
					}
				}
			);
		}
	});

	/////////////////////////
	// user authentication //
	/////////////////////////

	socket.on("authenticate", (credentials, callback) => {
		const failCallback = () => {
			callback({ success: false, reason: "Invalid username or password" });
		};
		if (!credentials.username || !credentials.password) failCallback();
		else {
			const auth = new Auth(database);
			auth.authenticateUser(
				credentials.username,
				credentials.password,
				(user) => {
					auth.generateJWT(
						user.ID,
						user.username,
						(token) => {
							callback({
								success: true,
								token: token,
							});
						},
						failCallback
					);
				},
				failCallback
			);
		}
	});

	///////////////////
	// get-user-data //
	///////////////////
	// TODO: WIP
	socket.on("get-user-data", (data, callback) => {
		if (!data.token) {
			callback({ success: false, reason: "No token provided" });
			return;
		}
		const auth = new Auth(database);
		auth.verifyJWT(data.token, (decodedToken) => {
			const user = new User(decodedToken.ID, decodedToken.username, database);
			callback({ success: true, data: user.getUserData() });
		});
	});

	////////////////
	// reconnects //
	////////////////

	socket.on("reconnect", () => {
		console.log("reconnect");
		if (userLoggedIn) setUserActiveState(socket, username, true);
	});

	/////////////////
	// disconnects //
	/////////////////

	socket.on("disconnect", () => {
		console.log("disconnect");
		if (userLoggedIn) setUserActiveState(socket, username, false);
	});
});

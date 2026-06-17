const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

io.on("connection", (socket) => {
    console.log("Bağlandı:", socket.id);

    socket.on("join-room", ({ room, username }) => {
        socket.room = room;
        socket.username = username;

        socket.join(room);

        if (!rooms[room]) {
            rooms[room] = {
                users: {},
                talkingUser: null
            };
        }

        rooms[room].users[socket.id] = username;

        console.log(`${username} odaya katıldı: ${room}`);

        socket.emit("existing-users", rooms[room].users);

        socket.to(room).emit("user-joined", {
            id: socket.id,
            username
        });

        io.to(room).emit("room-users", rooms[room].users);
    });

    socket.on("offer", ({ target, offer }) => {
        io.to(target).emit("offer", {
            from: socket.id,
            username: socket.username,
            offer
        });
    });

    socket.on("answer", ({ target, answer }) => {
        io.to(target).emit("answer", {
            from: socket.id,
            answer
        });
    });

    socket.on("ice-candidate", ({ target, candidate }) => {
        io.to(target).emit("ice-candidate", {
            from: socket.id,
            candidate
        });
    });

    socket.on("ptt-start", () => {
        if (!socket.room) return;

        const roomData = rooms[socket.room];
        if (!roomData) return;

        if (!roomData.talkingUser) {
            roomData.talkingUser = {
                id: socket.id,
                username: socket.username
            };

            io.to(socket.room).emit("ptt-start", {
                id: socket.id,
                username: socket.username
            });
        } else {
            socket.emit("channel-busy", {
                username: roomData.talkingUser.username
            });
        }
    });

    socket.on("ptt-stop", () => {
        if (!socket.room) return;

        const roomData = rooms[socket.room];
        if (!roomData) return;

        if (
            roomData.talkingUser &&
            roomData.talkingUser.id === socket.id
        ) {
            roomData.talkingUser = null;
            io.to(socket.room).emit("ptt-stop");
        }
    });

    socket.on("disconnect", () => {
        console.log("Ayrıldı:", socket.id);

        if (socket.room && rooms[socket.room]) {
            const roomData = rooms[socket.room];

            if (
                roomData.talkingUser &&
                roomData.talkingUser.id === socket.id
            ) {
                roomData.talkingUser = null;
                io.to(socket.room).emit("ptt-stop");
            }

            delete roomData.users[socket.id];

            socket.to(socket.room).emit("user-left", socket.id);
            io.to(socket.room).emit("room-users", roomData.users);
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log("Server çalışıyor. Port:", PORT);
});
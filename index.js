require("dotenv").config();
const express = require("express");
const { sign, verify } = require("jsonwebtoken");
// const cors = require("cors");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const { hash, compare } = require("bcrypt");

const SecretKey = "324GFgjkWYMkl27ls3f7#$3eul37jfl27#$@*(@*(^&53";

const app = express();
// app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 8081;

const dbPath = path.join(__dirname, "todo.db");
let db = null;

// app.use((req, res, next) => {
//   res.header("Access-Control-Allow-Origin", "http://localhost:3000");
//   res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
//   res.header("Access-Control-Allow-Headers", "Content-Type");
//   next();
// });

// Initializing DB And Server.
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(PORT, () => {
      console.log(`Server Running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.log(`DB Error: ${error}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// Register Api.
app.post("/register", async (request, response) => {
  const { name, mobile, email, age, location, gender, username, password } =
    request.body;
  const hashedPassword = await hash(password, 10);
  const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
  const dbuser = await db.get(selectUserQuery);
  if (dbuser === undefined) {
    const createUserQuery = `
            INSERT INTO
                users (name,mobile,email,age,location,gender,username,password)
            VALUES
            (
                '${name}',
                '${mobile}',
                '${email}',
                 ${age},
                '${location}',
                '${gender}',
                '${username}',
                '${hashedPassword}'
            )
        `;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send({ message: "User Created Successfully." });
  } else {
    response.status(400);
    response.send({ message: "User Already Exists." });
  }
});

// Login Api.
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send({ message: "Invalid User." });
  } else {
    const isPasswordMatched = await compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = sign(payload, SecretKey);
      console.log(jwtToken);
      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send({ message: "Invalid Password." });
    }
  }
});

const authenticateToken = (request, response, next) => {
  const authHeader = request.headers;
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader["authorization"].split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send({ message: "Unauthorized user." });
  } else {
    verify(jwtToken, SecretKey, async (error, payload) => {
      if (error) {
        response.status(401);
        response.send({ message: "Unauthorized User." });
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/", async (request, response) => {
  response.send(`<h1>This is server homePage</h1>`);
});

// Create New Todo Api.
app.post("/new-todo", authenticateToken, async (request, response) => {
  const {
    todoTitle,
    todoDescription,
    todoTag,
    todoStatus,
    createdTime,
    createdDate,
  } = request.body;
  console.log(
    todoTitle,
    todoDescription,
    todoTag,
    todoStatus,
    createdTime,
    createdDate
  );
  const { username } = request;
  const getUserIdQuery = `SELECT id FROM users WHERE username = '${username}'`;
  const dbUser = await db.get(getUserIdQuery);
  const userId = dbUser.id;
  const createTodoQuery = `INSERT INTO todos (todo_title, todo_description, user_id, todo_tag, todo_status, created_time, created_date)
    VALUES ('${todoTitle}', '${todoDescription}', ${userId}, '${todoTag}', '${todoStatus}', '${createdTime}', '${createdDate}')`;

  const dbRes = await db.run(createTodoQuery);
  response.status(200);
  response.send({ message: "Todo Created Successfully." });
});

// Get All todo Api..
app.get("/alltodos", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectUserIdQuery = `SELECT id FROM users WHERE username = '${username}'`;
  const dbUserId = await db.get(selectUserIdQuery);
  const userId = dbUserId.id;
  const selectAllTodoQuery = `SELECT id, todo_title, todo_description, todo_tag, todo_status, created_time, created_date FROM todos WHERE user_id = '${userId}'`;
  const dbAllTodo = await db.all(selectAllTodoQuery);
  console.log(dbAllTodo);
  response.status(200);
  response.send({ all_todos: dbAllTodo });
});

// Get profile username..
app.get("/username", authenticateToken, async (request, response) => {
  const { username } = request;
  response.status(200);
  response.send({ username: username });
});

// Get Profile complete info..
app.get("/profile-info", authenticateToken, async (request, response) => {
  const { username } = request;
  const QueryToGetUserProfileInfo = `SELECT age,email,gender,id,location,mobile,name,username FROM users WHERE username = '${username}'`;
  const userProfileInfo = await db.get(QueryToGetUserProfileInfo);
  response.status(200).send({ message: userProfileInfo });
});

// update todo status..
app.patch(
  "/update-todo-status",
  authenticateToken,
  async (request, response) => {
    const { todoStatus } = request.body;
    const { todoId } = request.query;
    const QueryToUpdateTodoStatu = `UPDATE todos SET todo_status = '${todoStatus}' WHERE id = '${todoId}'`;
    const dbRes = await db.run(QueryToUpdateTodoStatu);
    response.status(200);
    response.send({ message: "Todo Status updated Successfully." });
  }
);

// delete todo..
app.delete("/delete-todo", authenticateToken, async (request, response) => {
  const { todoId } = request.query;
  const QueryForRemoveTodo = `DELETE FROM todos WHERE id = ${todoId};`;
  const dbRes = await db.run(QueryForRemoveTodo);
  response.status(200).send({ message: "Todo Deleted successfully" });
});

// Delete Account permanently..
app.delete("/delete-account", authenticateToken, async (request, response) => {
  const { username } = request;
  const { password } = request.body;

  console.log(username);
  console.log(password);

  const passwordConstants = {
    onDeletedSuccess: "Account has been deleted permanently and successfully",
    onDeleteFailed: "Wrong Password. Account Deleted Failed",
  };

  const queryForSelectHashPassword = `SELECT password FROM users WHERE username = '${username}'`;
  const dbRes = await db.get(queryForSelectHashPassword);
  const userHashedPassword = dbRes.password;

  const verifyPassword = await compare(password, userHashedPassword);

  if (verifyPassword) {
    const queryDeleteAccount = `DELETE FROM users WHERE username='${username}'`;
    const dbResponse = await db.run(queryDeleteAccount);
    response.status(200).send({
      message: passwordConstants.onDeletedSuccess,
    });
  } else {
    response.status(400).send({ message: passwordConstants.onDeleteFailed });
  }
});

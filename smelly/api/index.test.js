const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_SECRET = "change-me-in-production";

// ── Mock setup ──

const mockSql = jest.fn();
jest.mock("@neondatabase/serverless", () => ({
  neon: () => mockSql,
}));

const mockPut = jest.fn();
const mockDel = jest.fn();
jest.mock("@vercel/blob", () => ({
  put: (...args) => mockPut(...args),
  del: (...args) => mockDel(...args),
}));

const mockSendMail = jest.fn().mockResolvedValue({});
jest.mock("nodemailer", () => ({
  createTransport: () => ({ sendMail: mockSendMail }),
}));

let app;

function makeToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

const testUser = { id: 1, email: "test@example.com", name: "Test User" };
const authHeader = () => `Bearer ${makeToken(testUser)}`;

beforeEach(() => {
  jest.clearAllMocks();
  // Reset migration state by re-requiring the module
  jest.resetModules();
  mockSql.mockResolvedValue([]);
  app = require("./index");
});

// ── Migration middleware ──

describe("Auto-migration middleware", () => {
  it("runs migration on first request", async () => {
    await request(app).get("/api/todos").set("Authorization", authHeader());
    // 3 CREATE TABLE + 1 ALTER TABLE + 1 SELECT for todos
    expect(mockSql).toHaveBeenCalled();
  });

  it("skips migration on subsequent requests", async () => {
    await request(app).get("/api/todos").set("Authorization", authHeader());
    const callCount = mockSql.mock.calls.length;

    await request(app).get("/api/todos").set("Authorization", authHeader());
    // Only the route query should have been called, not the migration ones
    expect(mockSql.mock.calls.length).toBeLessThan(callCount * 2);
  });

  it("handles migration ALTER TABLE failure gracefully", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockRejectedValueOnce(new Error("column already exists")) // ALTER TABLE
      .mockResolvedValue([]); // subsequent queries

    const res = await request(app).get("/api/todos").set("Authorization", authHeader());
    expect(res.status).toBe(200);
  });

  it("passes migration errors to error handler", async () => {
    mockSql.mockRejectedValueOnce(new Error("DB connection failed"));

    const res = await request(app).get("/api/todos").set("Authorization", authHeader());
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});

// ── Auth: requireAuth ──

describe("requireAuth middleware", () => {
  it("rejects requests without Authorization header", async () => {
    // Need migration to pass first
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });

  it("rejects requests with malformed Authorization header", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "NotBearer token");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });

  it("rejects requests with invalid token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer invalidtoken");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired token");
  });

  it("rejects requests with expired token", async () => {
    const expired = jwt.sign(testUser, JWT_SECRET, { expiresIn: "0s" });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired token");
  });
});

// ── POST /api/auth/signup ──

describe("POST /api/auth/signup", () => {
  it("creates a new user and returns token", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]) // SELECT existing user
      .mockResolvedValueOnce([]); // INSERT user

    const res = await request(app).post("/api/auth/signup").send({
      name: "New User",
      email: "NEW@Example.COM",
      password: "secret123",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.name).toBe("New User");
    expect(res.body.user.email).toBe("new@example.com");
  });

  it("returns 400 if name is missing", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "a@b.com",
      password: "secret123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Name/i);
  });

  it("returns 400 if name is empty", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "   ",
      email: "a@b.com",
      password: "secret123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Name/i);
  });

  it("returns 400 if email is missing", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "Test",
      password: "secret123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Email/i);
  });

  it("returns 400 if email is empty", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "Test",
      email: "  ",
      password: "secret123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Email/i);
  });

  it("returns 400 if password is too short", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "Test",
      email: "a@b.com",
      password: "12345",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/);
  });

  it("returns 400 if password is missing", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "Test",
      email: "a@b.com",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/);
  });

  it("returns 409 if email already exists", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: 1 }]); // SELECT existing user

    const res = await request(app).post("/api/auth/signup").send({
      name: "Test",
      email: "existing@test.com",
      password: "secret123",
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already in use/i);
  });
});

// ── POST /api/auth/signin ──

describe("POST /api/auth/signin", () => {
  it("signs in with valid credentials", async () => {
    const hash = await bcrypt.hash("secret123", 10);
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "1", name: "Test", email: "test@example.com", password_hash: hash }]);

    const res = await request(app).post("/api/auth/signin").send({
      email: "test@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("test@example.com");
    expect(res.body.user.id).toBe(1);
  });

  it("returns 400 if email is missing", async () => {
    const res = await request(app).post("/api/auth/signin").send({ password: "secret" });
    expect(res.status).toBe(400);
  });

  it("returns 400 if password is missing", async () => {
    const res = await request(app).post("/api/auth/signin").send({ email: "a@b.com" });
    expect(res.status).toBe(400);
  });

  it("returns 401 if user not found", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // SELECT user (empty)

    const res = await request(app).post("/api/auth/signin").send({
      email: "nobody@test.com",
      password: "secret123",
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid email or password/);
  });

  it("returns 401 if password is wrong", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "1", name: "Test", email: "test@example.com", password_hash: hash }]);

    const res = await request(app).post("/api/auth/signin").send({
      email: "test@example.com",
      password: "wrong-password",
    });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/auth/me ──

describe("GET /api/auth/me", () => {
  it("returns current user info", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "1", name: "Test User", email: "test@example.com" }]);

    const res = await request(app).get("/api/auth/me").set("Authorization", authHeader());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.name).toBe("Test User");
    expect(res.body.email).toBe("test@example.com");
  });

  it("returns 401 if user not found in DB", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // SELECT user (empty)

    const res = await request(app).get("/api/auth/me").set("Authorization", authHeader());
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("User not found");
  });
});

// ── GET /api/todos ──

describe("GET /api/todos", () => {
  it("returns empty list when no todos", async () => {
    const res = await request(app).get("/api/todos").set("Authorization", authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns todos with attachments", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([
        { id: "100", parent_id: null, title: "Todo 1", description: "Desc", status: "pending", due_date: "2025-01-01", user_id: "1" },
        { id: "200", parent_id: "100", title: "Todo 2", description: "", status: "done", due_date: null, user_id: "1" },
      ]) // SELECT todos
      .mockResolvedValueOnce([
        { id: "att1", todo_id: "100", blob_url: "https://blob.com/file1", original_name: "file1.txt", size: "1024" },
      ]); // SELECT attachments

    const res = await request(app).get("/api/todos").set("Authorization", authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    expect(res.body[0].id).toBe(100);
    expect(res.body[0].parentId).toBeNull();
    expect(res.body[0].title).toBe("Todo 1");
    expect(res.body[0].dueDate).toBe("2025-01-01");
    expect(res.body[0].attachments).toHaveLength(1);
    expect(res.body[0].attachments[0].originalName).toBe("file1.txt");
    expect(res.body[0].attachments[0].size).toBe(1024);

    expect(res.body[1].id).toBe(200);
    expect(res.body[1].parentId).toBe(100);
    expect(res.body[1].attachments).toHaveLength(0);
    expect(res.body[1].description).toBe("");
  });
});

// ── POST /api/todos ──

describe("POST /api/todos", () => {
  it("creates a todo", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // INSERT

    const res = await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      title: "My Todo",
      description: "A description",
      dueDate: "2025-06-01",
    });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("My Todo");
    expect(res.body.description).toBe("A description");
    expect(res.body.status).toBe("pending");
    expect(res.body.dueDate).toBe("2025-06-01");
    expect(res.body.attachments).toEqual([]);
    expect(res.body.parentId).toBeNull();
  });

  it("creates a todo with valid status", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // INSERT

    const res = await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      title: "Done Todo",
      status: "done",
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("done");
  });

  it("defaults to pending for invalid status", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // INSERT

    const res = await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      title: "Bad Status",
      status: "invalid-status",
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
  });

  it("creates a child todo with parentId", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: 50 }]) // SELECT parent
      .mockResolvedValueOnce([]); // INSERT

    const res = await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      title: "Child Todo",
      parentId: 50,
    });

    expect(res.status).toBe(201);
    expect(res.body.parentId).toBe(50);
  });

  it("returns 400 if parent not found", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // SELECT parent (empty)

    const res = await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      title: "Child",
      parentId: 999,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Parent not found/);
  });

  it("returns 400 if title is missing", async () => {
    const res = await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      description: "No title",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Title/i);
  });

  it("returns 400 if title is empty", async () => {
    const res = await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      title: "   ",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Title/i);
  });

  it("trims title and description", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // INSERT

    const res = await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      title: "  Trimmed  ",
      description: "  Trimmed desc  ",
    });

    expect(res.body.title).toBe("Trimmed");
    expect(res.body.description).toBe("Trimmed desc");
  });

  it("sends email notification for new todo", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // INSERT

    await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      title: "Email Todo",
    });

    // sendNewTodoEmail is fire-and-forget, give it a tick
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: testUser.email,
        subject: expect.stringContaining("Email Todo"),
      })
    );
  });

  it("handles email failure gracefully", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // INSERT

    const res = await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      title: "Email Fail Todo",
    });

    expect(res.status).toBe(201);
  });

  it("handles missing description", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // INSERT

    const res = await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      title: "No Desc",
    });

    expect(res.status).toBe(201);
    expect(res.body.description).toBe("");
    expect(res.body.dueDate).toBeNull();
  });
});

// ── PUT /api/todos/:id ──

describe("PUT /api/todos/:id", () => {
  it("updates a todo", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100", title: "Old Title", description: "Old Desc", status: "pending", due_date: null, parent_id: null, user_id: "1" }]) // SELECT todo
      .mockResolvedValueOnce([]) // UPDATE
      .mockResolvedValueOnce([]); // SELECT attachments

    const res = await request(app).put("/api/todos/100").set("Authorization", authHeader()).send({
      title: "New Title",
      status: "done",
    });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("New Title");
    expect(res.body.status).toBe("done");
    expect(res.body.description).toBe("Old Desc");
  });

  it("returns 404 if todo not found", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // SELECT todo (empty)

    const res = await request(app).put("/api/todos/999").set("Authorization", authHeader()).send({
      title: "Updated",
    });
    expect(res.status).toBe(404);
  });

  it("preserves existing fields when not provided", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100", title: "Keep This", description: "Keep Desc", status: "in-progress", due_date: "2025-12-01", parent_id: "50", user_id: "1" }])
      .mockResolvedValueOnce([]) // UPDATE
      .mockResolvedValueOnce([]); // SELECT attachments

    const res = await request(app).put("/api/todos/100").set("Authorization", authHeader()).send({});

    expect(res.body.title).toBe("Keep This");
    expect(res.body.description).toBe("Keep Desc");
    expect(res.body.status).toBe("in-progress");
    expect(res.body.dueDate).toBe("2025-12-01");
    expect(res.body.parentId).toBe(50);
  });

  it("returns attachments with the updated todo", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100", title: "T", description: "", status: "pending", due_date: null, parent_id: null, user_id: "1" }])
      .mockResolvedValueOnce([]) // UPDATE
      .mockResolvedValueOnce([
        { id: "att1", blob_url: "https://blob.com/f", original_name: "pic.png", size: "2048" },
      ]); // SELECT attachments

    const res = await request(app).put("/api/todos/100").set("Authorization", authHeader()).send({ title: "T" });

    expect(res.body.attachments).toHaveLength(1);
    expect(res.body.attachments[0].id).toBe("att1");
    expect(res.body.attachments[0].size).toBe(2048);
  });

  it("handles null description in existing todo", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100", title: "T", description: null, status: "pending", due_date: null, parent_id: null, user_id: "1" }])
      .mockResolvedValueOnce([]) // UPDATE
      .mockResolvedValueOnce([]); // SELECT attachments

    const res = await request(app).put("/api/todos/100").set("Authorization", authHeader()).send({});

    expect(res.body.description).toBe("");
  });
});

// ── DELETE /api/todos/:id ──

describe("DELETE /api/todos/:id", () => {
  it("deletes a todo with cascade (default)", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100", parent_id: null, user_id: "1" }]) // SELECT todo
      .mockResolvedValueOnce([{ blob_url: "https://blob.com/f1" }]) // SELECT descendant attachments
      .mockResolvedValueOnce([]) // DELETE attachments
      .mockResolvedValueOnce([]); // DELETE todos

    mockDel.mockResolvedValueOnce({});

    const res = await request(app).delete("/api/todos/100").set("Authorization", authHeader());
    expect(res.status).toBe(204);
    expect(mockDel).toHaveBeenCalledWith("https://blob.com/f1");
  });

  it("deletes without cascade", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100", parent_id: "50", user_id: "1" }]) // SELECT todo
      .mockResolvedValueOnce([]) // UPDATE children
      .mockResolvedValueOnce([{ blob_url: "https://blob.com/f1" }]) // SELECT attachments
      .mockResolvedValueOnce([]) // DELETE attachments
      .mockResolvedValueOnce([]); // DELETE todo

    mockDel.mockResolvedValueOnce({});

    const res = await request(app).delete("/api/todos/100?cascade=false").set("Authorization", authHeader());
    expect(res.status).toBe(204);
  });

  it("returns 404 if todo not found", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // SELECT todo (empty)

    const res = await request(app).delete("/api/todos/999").set("Authorization", authHeader());
    expect(res.status).toBe(404);
  });

  it("handles blob deletion errors gracefully in cascade mode", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100", parent_id: null, user_id: "1" }]) // SELECT todo
      .mockResolvedValueOnce([{ blob_url: "https://blob.com/f1" }, { blob_url: "https://blob.com/f2" }]) // attachments
      .mockResolvedValueOnce([]) // DELETE attachments
      .mockResolvedValueOnce([]); // DELETE todos

    mockDel.mockRejectedValueOnce(new Error("blob error")).mockResolvedValueOnce({});

    const res = await request(app).delete("/api/todos/100").set("Authorization", authHeader());
    expect(res.status).toBe(204);
  });

  it("handles blob deletion errors gracefully in non-cascade mode", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100", parent_id: null, user_id: "1" }]) // SELECT todo
      .mockResolvedValueOnce([]) // UPDATE children
      .mockResolvedValueOnce([{ blob_url: "https://blob.com/f1" }]) // SELECT attachments
      .mockResolvedValueOnce([]) // DELETE attachments
      .mockResolvedValueOnce([]); // DELETE todo

    mockDel.mockRejectedValueOnce(new Error("blob error"));

    const res = await request(app).delete("/api/todos/100?cascade=false").set("Authorization", authHeader());
    expect(res.status).toBe(204);
  });

  it("re-parents children when not cascading", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100", parent_id: null, user_id: "1" }]) // SELECT todo (no parent)
      .mockResolvedValueOnce([]) // UPDATE children parent_id
      .mockResolvedValueOnce([]) // SELECT attachments
      .mockResolvedValueOnce([]) // DELETE attachments
      .mockResolvedValueOnce([]); // DELETE todo

    const res = await request(app).delete("/api/todos/100?cascade=false").set("Authorization", authHeader());
    expect(res.status).toBe(204);
  });
});

// ── POST /api/todos/:id/attachments ──

describe("POST /api/todos/:id/attachments", () => {
  it("uploads files to a todo", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100" }]) // SELECT todo
      .mockResolvedValueOnce([]); // INSERT attachment

    mockPut.mockResolvedValueOnce({ url: "https://blob.com/uploaded" });

    jest.spyOn(crypto, "randomBytes").mockReturnValueOnce(Buffer.from("aabbccddeeff", "hex"));

    const res = await request(app)
      .post("/api/todos/100/attachments")
      .set("Authorization", authHeader())
      .attach("files", Buffer.from("file content"), "test.txt");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].originalName).toBe("test.txt");
    expect(res.body[0].url).toBe("https://blob.com/uploaded");

    crypto.randomBytes.mockRestore();
  });

  it("returns 404 if todo not found", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // SELECT todo (empty)

    const res = await request(app)
      .post("/api/todos/999/attachments")
      .set("Authorization", authHeader())
      .attach("files", Buffer.from("data"), "file.txt");

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/todos/:id/attachments/:attId ──

describe("DELETE /api/todos/:id/attachments/:attId", () => {
  it("deletes an attachment", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100" }]) // SELECT todo
      .mockResolvedValueOnce([{ id: "att1", blob_url: "https://blob.com/f", todo_id: "100" }]) // SELECT attachment
      .mockResolvedValueOnce([]); // DELETE attachment

    mockDel.mockResolvedValueOnce({});

    const res = await request(app)
      .delete("/api/todos/100/attachments/att1")
      .set("Authorization", authHeader());

    expect(res.status).toBe(204);
    expect(mockDel).toHaveBeenCalledWith("https://blob.com/f");
  });

  it("returns 404 if todo not found", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // SELECT todo (empty)

    const res = await request(app)
      .delete("/api/todos/999/attachments/att1")
      .set("Authorization", authHeader());
    expect(res.status).toBe(404);
  });

  it("returns 404 if attachment not found", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100" }]) // SELECT todo
      .mockResolvedValueOnce([]); // SELECT attachment (empty)

    const res = await request(app)
      .delete("/api/todos/100/attachments/nonexistent")
      .set("Authorization", authHeader());
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Attachment not found");
  });

  it("handles blob deletion error gracefully", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([{ id: "100" }]) // SELECT todo
      .mockResolvedValueOnce([{ id: "att1", blob_url: "https://blob.com/f", todo_id: "100" }]) // SELECT attachment
      .mockResolvedValueOnce([]); // DELETE attachment

    mockDel.mockRejectedValueOnce(new Error("blob error"));

    const res = await request(app)
      .delete("/api/todos/100/attachments/att1")
      .set("Authorization", authHeader());
    expect(res.status).toBe(204);
  });
});

// ── signToken ──

describe("signToken", () => {
  it("produces a valid JWT with user data", () => {
    const token = jwt.sign({ id: 1, email: "a@b.com", name: "A" }, JWT_SECRET, { expiresIn: "7d" });
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.id).toBe(1);
    expect(decoded.email).toBe("a@b.com");
    expect(decoded.name).toBe("A");
  });
});

// ── sendNewTodoEmail ──

describe("sendNewTodoEmail", () => {
  it("sends email with todo details including description and dueDate", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // INSERT

    await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      title: "Detailed Todo",
      description: "Some details",
      dueDate: "2025-12-25",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Some details"),
      })
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("2025-12-25"),
      })
    );
  });

  it("handles missing description and dueDate in email", async () => {
    mockSql
      .mockResolvedValueOnce([]) // CREATE users
      .mockResolvedValueOnce([]) // CREATE todos
      .mockResolvedValueOnce([]) // CREATE attachments
      .mockResolvedValueOnce([]) // ALTER TABLE
      .mockResolvedValueOnce([]); // INSERT

    await request(app).post("/api/todos").set("Authorization", authHeader()).send({
      title: "Minimal Todo",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("(none)"),
      })
    );
  });
});

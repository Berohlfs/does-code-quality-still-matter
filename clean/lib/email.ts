import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface TodoEmailData {
  title: string;
  description?: string;
  status: string;
  dueDate?: string | null;
}

export async function sendNewTodoEmail(
  todo: TodoEmailData,
  recipientEmail: string
) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      subject: `New Todo: ${todo.title}`,
      text: [
        "A new todo item was added.",
        "",
        `Title: ${todo.title}`,
        `Description: ${todo.description || "(none)"}`,
        `Status: ${todo.status}`,
        `Due Date: ${todo.dueDate || "(none)"}`,
      ].join("\n"),
    });
  } catch (err) {
    console.error(
      "Failed to send todo email notification:",
      err instanceof Error ? err.message : err
    );
  }
}

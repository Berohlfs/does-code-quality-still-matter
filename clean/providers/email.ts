import nodemailer, { type Transporter } from "nodemailer";

interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
}

class EmailProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail({ to, subject, text }: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
      });
    } catch (err) {
      console.error(
        "Failed to send email:",
        err instanceof Error ? err.message : err
      );
    }
  }
}

export const emailProvider = new EmailProvider();

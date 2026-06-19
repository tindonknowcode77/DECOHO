import { Injectable, InternalServerErrorException } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

type VerificationLinkEmailPayload = {
  to: string;
  fullName: string;
  verificationLink: string;
  expiresIn: string;
};

@Injectable()
export class MailService {
  private transporter?: Transporter;

  async sendVerificationLinkEmail(
    payload: VerificationLinkEmailPayload,
  ): Promise<boolean> {
    if (!this.isSmtpConfigured()) {
      return false;
    }

    try {
      await this.getTransporter().sendMail({
        from: this.getMailFrom(),
        to: payload.to,
        subject: 'Verify your DECOHO account',
        text: this.buildVerificationText(payload),
        html: this.buildVerificationHtml(payload),
      });

      return true;
    } catch (error) {
      throw new InternalServerErrorException(
        'Unable to send verification email',
      );
    }
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST ?? 'smtp.gmail.com',
        port: Number(process.env.MAIL_PORT ?? 587),
        secure: process.env.MAIL_SECURE === 'true',
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });
    }

    return this.transporter;
  }

  private isSmtpConfigured(): boolean {
    return Boolean(process.env.MAIL_USER && process.env.MAIL_PASS);
  }

  private getMailFrom(): string {
    return (
      process.env.MAIL_FROM ??
      `DECOHO <${process.env.MAIL_USER ?? 'no-reply@decoho.local'}>`
    );
  }

  private buildVerificationText(
    payload: VerificationLinkEmailPayload,
  ): string {
    return [
      `Hello ${payload.fullName},`,
      '',
      'Please verify your DECOHO account by opening this link:',
      payload.verificationLink,
      '',
      `This link expires in ${payload.expiresIn}.`,
      '',
      'If you did not create a DECOHO account, you can ignore this email.',
    ].join('\n');
  }

  private buildVerificationHtml(
    payload: VerificationLinkEmailPayload,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Verify your DECOHO account</h2>
        <p>Hello ${payload.fullName},</p>
        <p>Please confirm your email address to activate your account.</p>
        <p>
          <a href="${payload.verificationLink}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:6px;">
            Verify Email
          </a>
        </p>
        <p>Or copy this link into your browser:</p>
        <p style="word-break: break-all;">${payload.verificationLink}</p>
        <p>This link expires in ${payload.expiresIn}.</p>
        <p>If you did not create a DECOHO account, you can ignore this email.</p>
      </div>
    `;
  }
}

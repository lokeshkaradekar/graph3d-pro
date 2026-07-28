import { renderEmailLayout, renderButton, heading, paragraph, fineprint, fallbackLink } from "./layout.js";
import { APP_NAME, BRAND } from "./brand.js";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function verificationEmailTemplate(url: string): RenderedEmail {
  const body = [
    heading("Verify your email"),
    paragraph(`Click the button below to confirm your email address and activate your ${APP_NAME} account.`),
    renderButton(url, "Verify email"),
    fallbackLink(url),
    fineprint(`This link expires in 24 hours. If you didn't create a ${APP_NAME} account, you can safely ignore this email.`),
  ].join("\n");

  return {
    subject: `Verify your ${APP_NAME} email`,
    html: renderEmailLayout({ preheader: `Confirm your email to finish setting up ${APP_NAME}.`, bodyHtml: body }),
    text:
      `Verify your ${APP_NAME} email\n\n${url}\n\n` +
      `This link expires in 24 hours. If you didn't create a ${APP_NAME} account, you can safely ignore this email.`,
  };
}

export function passwordResetEmailTemplate(url: string): RenderedEmail {
  const body = [
    heading("Reset your password"),
    paragraph(`We received a request to reset the password on your ${APP_NAME} account.`),
    renderButton(url, "Reset password"),
    fallbackLink(url),
    fineprint(`This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't be changed.`),
  ].join("\n");

  return {
    subject: `Reset your ${APP_NAME} password`,
    html: renderEmailLayout({ preheader: `Reset the password on your ${APP_NAME} account.`, bodyHtml: body }),
    text:
      `Reset your ${APP_NAME} password\n\n${url}\n\n` +
      `This link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
  };
}

export function paymentFailedEmailTemplate(
  planName: string,
  graceDate: string,
  billingUrl: string,
): RenderedEmail {
  const body = [
    heading("We couldn't process your payment"),
    paragraph(`Your ${APP_NAME} <strong style="color:${BRAND.ink};">${planName}</strong> payment didn't go through.`),
    paragraph(
      `Your subscription stays active until <strong style="color:${BRAND.ink};">${graceDate}</strong>. ` +
        `Update your payment method before then to avoid losing access.`,
    ),
    renderButton(billingUrl, "Update payment method", BRAND.danger),
    fallbackLink(billingUrl),
  ].join("\n");

  return {
    subject: `Action required: ${APP_NAME} payment failed`,
    html: renderEmailLayout({
      preheader: `Update your payment method by ${graceDate} to keep your ${planName} plan.`,
      bodyHtml: body,
    }),
    text:
      `Payment failed\n\nYour ${APP_NAME} ${planName} payment didn't go through. ` +
      `Your subscription stays active until ${graceDate}.\n\nUpdate your payment method: ${billingUrl}`,
  };
}

export function subscriptionCanceledEmailTemplate(
  planName: string,
  endDate: string,
  billingUrl: string,
): RenderedEmail {
  const body = [
    heading("Subscription canceled"),
    paragraph(`Your ${APP_NAME} <strong style="color:${BRAND.ink};">${planName}</strong> subscription has been canceled.`),
    paragraph(`You'll keep full access to ${planName} features until <strong style="color:${BRAND.ink};">${endDate}</strong>.`),
    renderButton(billingUrl, "Reactivate subscription"),
    fallbackLink(billingUrl),
  ].join("\n");

  return {
    subject: `Your ${APP_NAME} subscription has been canceled`,
    html: renderEmailLayout({ preheader: `You'll have ${planName} access until ${endDate}.`, bodyHtml: body }),
    text:
      `Subscription canceled\n\nYour ${APP_NAME} ${planName} subscription has been canceled. ` +
      `You'll have access until ${endDate}.\n\nReactivate: ${billingUrl}`,
  };
}

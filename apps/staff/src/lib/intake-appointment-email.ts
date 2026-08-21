import { getGoogleAuth, sendEmail } from "@/lib/google-mail";
import type { DeliverIntakeReminder } from "@wayfinder/supabase/intake-appointment-reminders";

/**
 * Email delivery for intake appointment reminders.
 * When SMS is approved, extend this to handle message.channel === "sms".
 */
export const deliverIntakeAppointmentReminder: DeliverIntakeReminder = async (message) => {
  if (message.channel === "sms") {
    return {
      ok: false,
      skip: true,
      error: "SMS channel not enabled yet",
    };
  }

  const to = message.toEmail?.trim();
  if (!to) {
    return {
      ok: false,
      skip: true,
      error: "Client has no email on file",
    };
  }

  try {
    const auth = await getGoogleAuth();
    await sendEmail(auth, {
      to,
      subject: message.subject,
      text: message.text,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed";
    console.error("intake appointment email failed:", msg);
    return { ok: false, error: msg };
  }
};

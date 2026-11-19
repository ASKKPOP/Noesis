/**
 * alert-mailer — how the Grid sends an email to one of its own account holders.
 *
 * AWS SES, configured by environment: ALERT_EMAIL_FROM (a sender address verified in
 * SES) and ALERT_EMAIL_REGION (else AWS_REGION). Credentials come from the AWS default
 * chain (the instance role in production) — never from the repository. With no
 * ALERT_EMAIL_FROM there is no mailer and nothing is sent. The SDK is loaded only when
 * a mail is sent, like the health watchdog's SNS client.
 */

export interface AlertMailer {
    send(to: string, subject: string, text: string): Promise<void>;
}

export function sesMailerFromEnv(env: NodeJS.ProcessEnv = process.env): AlertMailer | null {
    const from = env['ALERT_EMAIL_FROM'];
    if (!from) return null;
    const region = env['ALERT_EMAIL_REGION'] ?? env['AWS_REGION'];
    return {
        async send(to, subject, text) {
            const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2');
            const client = new SESv2Client(region ? { region } : {});
            await client.send(new SendEmailCommand({
                FromEmailAddress: from,
                Destination: { ToAddresses: [to] },
                Content: { Simple: { Subject: { Data: subject }, Body: { Text: { Data: text } } } },
            }));
        },
    };
}

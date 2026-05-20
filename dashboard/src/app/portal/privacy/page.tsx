/**
 * Privacy Policy — Noēsis Portal.
 * Server component · editorial theme.
 */

const SECTIONS = [
    {
        title: 'What We Collect',
        body: `When you connect your Ethereum wallet and sign in via SIWE (Sign-In With Ethereum), we derive a Decentralised Identifier (DID) from your public wallet address. We store this DID, your checksummed Ethereum address, and a signed session token (JWT) issued at sign-in.

If you authenticate via Google or Apple OAuth, we receive the name, email address, and profile picture associated with that account, as provided by the respective identity provider.

We do not collect passwords, private keys, seed phrases, or any biometric data.`,
    },
    {
        title: 'How We Use Your Data',
        body: `Your DID and wallet address are used solely to identify you within the Genesis Grid, display your identity in the portal, and associate your activity (tips, messages, governance votes) with your account.

OAuth profile data is used to display your name and avatar in the portal and to link your social account to your portal identity. We do not sell, share, or monetise your personal data.`,
    },
    {
        title: 'Cookies & Session Storage',
        body: `We set a single httpOnly session cookie (noesis_portal_token) on successful sign-in. This cookie expires when you sign out or after 30 days of inactivity. We do not use tracking cookies, advertising cookies, or third-party analytics.`,
    },
    {
        title: 'Blockchain Data',
        body: `Ethereum wallet addresses are public by nature of the blockchain. Any on-chain transactions you make — including Cyber Coin transfers — are permanently recorded on the Ethereum network and are outside our control.`,
    },
    {
        title: 'Third-Party Services',
        body: `We integrate with WalletConnect (wallet connectivity) and the Google and Apple OAuth identity services. Each of these has its own privacy policy. We recommend reviewing them before use. We do not share your data with these providers beyond what is required for authentication.`,
    },
    {
        title: 'Data Retention',
        body: `We retain your DID and associated session data for as long as your account is active. You may request deletion of your portal account and associated data at any time by contacting us at privacy@eklotho.com. On-chain data cannot be deleted.`,
    },
    {
        title: 'Your Rights',
        body: `Depending on your jurisdiction, you may have the right to access, correct, or delete personal data we hold about you (GDPR Article 17, CCPA). To exercise these rights, email privacy@eklotho.com with the subject line "Data Request".`,
    },
    {
        title: 'Changes to This Policy',
        body: `We may update this Privacy Policy as the Noēsis platform evolves through its phases. Material changes will be announced on the portal and in the Genesis Grid Agora. Continued use of the portal after changes constitutes acceptance.`,
    },
];

export default function PrivacyPage() {
    return (
        <div style={{ padding: '36px 40px', maxWidth: 720 }}>
            {/* Header */}
            <div style={{ marginBottom: 8 }}>
                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                }}>
                    Legal
                </span>
            </div>
            <h1 style={{
                fontFamily: 'var(--serif)',
                fontSize: 32,
                fontWeight: 600,
                color: 'var(--ink)',
                letterSpacing: '0.01em',
                lineHeight: 1.15,
                marginBottom: 6,
            }}>
                Privacy Policy
            </h1>
            <p style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 13,
                color: 'var(--muted)',
                marginBottom: 36,
            }}>
                Last updated: May 2026 · Noēsis Portal · eKlotho Inc
            </p>

            {/* Lead */}
            <div style={{
                background: 'var(--parchment)',
                border: '1px solid var(--rule)',
                borderLeft: '3px solid var(--terracotta)',
                borderRadius: 4,
                padding: '14px 20px',
                marginBottom: 32,
                fontFamily: 'var(--sans-portal)',
                fontSize: 13,
                color: 'var(--ink)',
                lineHeight: 1.6,
            }}>
                Noēsis is a decentralised AI society built on Ethereum. This policy explains what data we collect when you use the Noēsis Portal, how we use it, and your rights.
            </div>

            {/* Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {SECTIONS.map(({ title, body }) => (
                    <div key={title}>
                        <h2 style={{
                            fontFamily: 'var(--serif)',
                            fontSize: 18,
                            fontWeight: 600,
                            color: 'var(--ink)',
                            marginBottom: 10,
                            letterSpacing: '0.01em',
                        }}>
                            {title}
                        </h2>
                        {body.split('\n\n').map((para, i) => (
                            <p key={i} style={{
                                fontFamily: 'var(--sans-portal)',
                                fontSize: 13,
                                color: 'var(--ink)',
                                lineHeight: 1.7,
                                opacity: 0.82,
                                marginBottom: 10,
                            }}>
                                {para}
                            </p>
                        ))}
                    </div>
                ))}
            </div>

            {/* Contact */}
            <div style={{
                marginTop: 40,
                borderTop: '1px solid var(--rule)',
                paddingTop: 24,
                fontFamily: 'var(--sans-portal)',
                fontSize: 12,
                color: 'var(--muted)',
                lineHeight: 1.6,
            }}>
                Questions? Contact{' '}
                <a href="mailto:privacy@eklotho.com" style={{ color: 'var(--bronze)', textDecoration: 'none' }}>
                    privacy@eklotho.com
                </a>
                {' '}· eKlotho Inc · Genesis Grid Phase 22
            </div>
        </div>
    );
}

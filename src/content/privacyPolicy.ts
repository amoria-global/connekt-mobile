/**
 * Legal content — lifted verbatim from the web reference
 * (knockout/app/pages/{privacy-policy,terms-of-service}.tsx). Edit there
 * and re-extract rather than diverging the copy between web and mobile.
 */
export type LegalSection = { id?: string; title: string; content: string };

export const PRIVACY_SECTIONS: LegalSection[] = [
    {
      id: 'privacy-policy',
      title: 'Privacy Policy Overview',
      content: `This Privacy Policy describes how Amoria Connekyt, operated by Amoria Global Tech Ltd. (Rwanda), collects, uses, stores, and protects personal information from users of our website, mobile applications, and related digital services (the Platform).

By creating an account, booking or providing services, or accessing the Platform, you agree to this Privacy Policy and our commitment to protect your privacy under Rwanda's Data Protection and Privacy Law No. 058/2021 and other applicable international laws.

Key Definitions:
• Personal Data: Any information that can identify a person, such as name, email, or phone number.
• Data Subject: A person whose personal information is collected or processed by Amoria Connekyt.
• Data Controller: Amoria Global Tech Ltd., which determines how and why data is processed.
• Data Processor: Any third party that processes personal data on behalf of Amoria Connekyt.
• Processing: Any operation performed on personal data, including collection, use, storage, or deletion.

Our Commitment to Responsible Innovation:
At Amoria Connekyt, we believe technology should connect people safely and meaningfully. We are committed to protecting privacy, promoting mental wellness, and using data responsibly to support creativity, trust, and emotional connection across our community.`
    },
    {
      id: 'information-collection',
      title: 'Information We Collect',
      content: `We collect only what is necessary to deliver and improve our services. Understanding what information we collect and why helps you make informed decisions about using Amoria Connekyt. Below is a comprehensive breakdown of the types of data we collect:

1. Personal Information
We collect basic personal information to create and manage your account securely. This includes your name, email address, phone number, and account login credentials. When you register on our platform, we ask for accurate contact details to ensure we can communicate important updates, verify your identity, and provide customer support when needed. For enhanced security and to comply with Know Your Customer (KYC) requirements, we may also collect identity verification documents such as national ID, passport, or driver's license. This information is essential for preventing fraud, ensuring platform security, and meeting legal compliance obligations under Rwanda's Data Protection and Privacy Law.

2. Service & Booking Data
To facilitate successful collaborations between clients and creators, we collect detailed information about your projects and bookings. This includes comprehensive project details such as event descriptions, photography requirements, preferred styles, locations, dates, timelines, and pricing agreements. We also store all communication between clients and creators conducted through our platform to ensure transparency, provide dispute resolution support, and maintain a record of agreed terms. For photographers and videographers, we collect professional details including your biography, service offerings, specialties, portfolio descriptions, and links to social media profiles. This information helps clients find the right creative professional for their needs and enables creators to showcase their expertise effectively.

3. Payment Data
Financial security is paramount at Amoria Connekyt. Payments are completed through our secure payment partner (XentriPay) on our website (connekyt.com), not collected inside the app. When you make a payment, you are directed to XentriPay's secure web checkout, which processes the transaction and returns a confirmation to us. We do not store your full card or mobile-money details on our servers. We retain related transaction information such as billing details, transaction histories, invoice records, and payment confirmations. All payment processing is handled securely by our certified payment partner using industry-standard encryption protocols (PCI DSS compliance). We maintain transaction records for accounting purposes, tax compliance, dispute resolution, and to provide you with comprehensive payment history accessible through your dashboard.

4. Media & Content
As a platform connecting creative professionals with clients, we naturally handle various forms of media content. This includes all photos, videos, audio files, and other creative materials that you upload, share, or store via the Platform. For photographers and videographers, this encompasses your portfolio images, sample work, promotional materials, and demonstration videos that showcase your capabilities. For clients, this may include reference materials, inspiration boards, or final deliverables received from creators. We store this content securely with appropriate access controls to protect your intellectual property while enabling the platform functionality you expect.

5. Technical Data
To provide a smooth, efficient user experience and continuously improve our platform, we automatically collect certain technical information when you use Amoria Connekyt. This includes device information such as your IP address, browser type and version, operating system, device identifiers, and screen resolution. We also track usage patterns including pages viewed, features accessed, duration of sessions, click patterns, search queries, and navigation paths. This data helps us understand how users interact with our platform, identify technical issues, optimize performance, prevent fraud, and develop new features that better serve our community. We use cookies and similar tracking technologies to remember your preferences, maintain your login session, and analyze platform performance.

6. Communication Records
We maintain records of all communications conducted through our platform to ensure quality service and provide support when needed. This includes emails sent through our system, in-platform messages and chats exchanged between users, customer support conversations, feedback submissions, and inquiries sent through our contact forms or support channels. These records help us resolve disputes, improve our services based on user feedback, provide better customer support, and ensure compliance with our terms of service and community guidelines.

7. Location Information
With your explicit permission, we may collect precise or approximate location data from your device. This information helps us provide location-based services such as matching you with nearby photographers or clients, suggesting local creative professionals, displaying relevant search results based on geography, and enhancing the accuracy of event planning features. You can control location permissions through your device settings or app preferences at any time. Location data is used solely to improve your experience and is never shared with third parties for marketing purposes without your consent.

8. Facial Recognition & Biometric Data
Amoria Connekyt offers an optional face-search feature that helps you find photos of yourself across event galleries. If you choose to opt in and take a selfie, we process that selfie as biometric (face) data solely to match it against event photos and surface pictures that appear to include you. This processing happens only with your explicit consent. Your face data is never used for advertising, is not sold or shared with third parties, and is not used for any purpose other than helping you find your own photos. You can withdraw consent at any time, and your face data is deleted on request or when you delete your account. If you do not opt in, no facial-recognition processing takes place.

9. Live Broadcast Data (Self-Streaming)
When you use our self-streaming feature to broadcast your own live video (for example, a self-streamed private event), we process your live camera and microphone feed in order to transmit the broadcast to your intended audience. This live media is delivered through our media and streaming provider (Cloudflare Stream). You control when a broadcast starts and stops.

10. Push Notification Token
If you enable push notifications, we collect a device push notification token through our push notification provider (Expo) so we can send you booking updates, messages, and other alerts. You can disable push notifications at any time through your device settings, which stops us from sending them.`
    },
    {
      id: 'information-sharing',
      title: 'Data Sharing and Disclosure',
      content: `Your privacy and trust are fundamental to our operations. Amoria Connekyt does not sell, rent, or trade your personal data to third parties for marketing purposes. We only share your information when necessary to deliver our services, comply with legal obligations, or with your explicit consent. Below is a detailed explanation of when and how we share your data:

1. Other Platform Users
To enable the core functionality of our platform (connecting clients with creative professionals), certain information must be shared between users. When you book a photographer or accept a client booking, relevant contact information and project details are shared to facilitate communication and collaboration. Your public profile information, including your name, profile photo, biography, and portfolio (for creators), is visible to other users browsing our platform. This visibility is essential for clients to discover and evaluate photographers, and for creators to showcase their work and attract clients. However, sensitive information like your full contact details, payment information, and private messages remain protected and are only shared with parties directly involved in your transactions.

2. Payment Processors
All financial transactions on Amoria Connekyt are processed through our trusted, licensed payment partner, XentriPay. Payments are completed on our website (connekyt.com) via XentriPay's secure checkout; the app itself does not collect your card or mobile-money details. XentriPay is carefully selected based on its security credentials, regulatory compliance, and track record. When you make a payment or receive funds, necessary transaction information is securely transmitted to XentriPay for verification and processing. All payment data is encrypted using industry-standard SSL/TLS protocols during transmission. We do not store your full card or mobile-money details on our servers. This information is tokenized and secured by our payment partner, who is certified as PCI DSS compliant.

3. Service Providers and Technology Partners
To deliver a high-quality platform experience, we partner with reputable third-party service providers who assist with various operational functions. Our cloud hosting providers store data securely in encrypted servers located in jurisdictions with strong data protection laws (Rwanda, EU, Kenya, South Africa). Analytics services help us understand how users interact with our platform, identify areas for improvement, and optimize performance. This data is typically aggregated and anonymized. Email and communication tools enable us to send important notifications, updates, and support messages. Identity verification partners assist with KYC compliance, helping us verify user identities while preventing fraud and ensuring platform security. All these service providers are bound by strict confidentiality agreements and are only permitted to access data necessary for their specific functions.

4. Legal or Government Bodies
We may disclose your information to law enforcement, regulatory authorities, or other government bodies when required by law or when we believe in good faith that such disclosure is necessary. This includes situations where we receive a valid legal process such as a court order, subpoena, or warrant. We comply with Rwanda's legal obligations under the oversight of regulatory bodies including the National Bank of Rwanda (BNR), National Cyber Security Authority (NCSA), Rwanda Investigation Bureau (RIB), and Financial Intelligence Centre (FIC). We may also disclose information to protect our rights, property, or safety, or that of our users or the public. For example, to prevent fraud, investigate security threats, or respond to illegal activities. For Anti-Money Laundering and Counter-Terrorism Financing (AML/CTF) compliance, we may report suspicious activities as required under Rwanda's Law No. 69/2018. During legal proceedings or investigations, we cooperate with authorities while respecting user privacy to the extent permitted by law.

5. Business Transfers
In the event of a corporate transaction such as a merger, acquisition, reorganization, or sale of assets, user information may be transferred to the acquiring or successor entity. However, we ensure that any such transfer is conducted under equivalent or stronger privacy protections. Users will be notified of any ownership changes, and the new entity will be bound by the terms of this Privacy Policy unless you consent to a new policy. Your rights to access, modify, or delete your data will continue to be honored by the successor organization.

6. Partners Who Meet Equivalent Standards
We only collaborate with partners who demonstrate a commitment to data protection and privacy that meets or exceeds our own standards. This means all partners must comply with Rwanda's Data Protection and Privacy Law No. 058/2021, GDPR requirements where applicable, and ISO 27701 (Privacy Information Management System) standards. Before partnering with any organization, we conduct thorough due diligence to assess their security practices, data handling procedures, and compliance track record. Partners are contractually obligated to protect user data and are prohibited from using it for purposes beyond those specified in their service agreements with us.

7. With Your Explicit Consent
Beyond the sharing described above, we may share your information with other third parties only when you provide explicit consent. This might occur when you choose to integrate third-party services, participate in promotional partnerships, or authorize specific data sharing for enhanced features. You can withdraw your consent at any time through your account settings or by contacting our privacy team.

Our Commitment:
We never sell or rent personal information to third parties for marketing purposes. We do not share your data with advertisers who wish to target you based on your platform activity. Your information is valuable, and we treat it with the highest level of care and respect it deserves.`
    },
    {
      id: 'data-security',
      title: 'Data Storage and Security',
      content: `Protecting your data is not just a legal obligation. It's a fundamental commitment that underpins everything we do at Amoria Connekyt. We employ multiple layers of security controls, industry-leading technologies, and rigorous operational practices to safeguard your personal information, creative work, and financial transactions from unauthorized access, alteration, disclosure, or destruction.

1. Technical Security Measures
At the core of our security architecture is comprehensive encryption that protects your data throughout its entire lifecycle. Every piece of information transmitted between your device and our servers travels through SSL/TLS encrypted connections using 256-bit encryption, the same military-grade standard used by banks and government agencies. This means that even if someone intercepts data in transit, they cannot decipher its contents without the encryption keys.

Data at rest (information stored on our servers) is equally protected through advanced encryption algorithms (AES-256). Your personal information, portfolio images, videos, messages, payment details, and transaction records are all encrypted in our databases. Even our own system administrators cannot view sensitive data like passwords (which are hashed using bcrypt with salt) or payment information without proper authorization and audit trails.

We conduct regular security audits and vulnerability assessments performed by independent, third-party cybersecurity firms. These experts attempt to penetrate our systems using the same techniques employed by malicious actors, identifying potential weaknesses before they can be exploited. Any vulnerabilities discovered are immediately prioritized and remediated according to their severity level. Our infrastructure benefits from enterprise-grade firewall protection that filters all incoming and outgoing traffic, blocking known malicious IP addresses, suspicious traffic patterns, and attempted intrusions.

Our intrusion detection and prevention systems (IDS/IPS) monitor network traffic continuously, using sophisticated algorithms and threat intelligence feeds to identify and block attack attempts in real-time. We maintain full compliance with Rwanda's Data Protection and Privacy Law (DPPL), the European Union's General Data Protection Regulation (GDPR), and ISO 27701 Privacy Information Management System standards. This isn't merely checkbox compliance. We've embedded these requirements into our development processes, operational procedures, and corporate culture.

2. Access Control and Authorization
Not everyone needs access to everything. We implement strict role-based access control (RBAC) that ensures employees and contractors can only access information necessary for their specific job functions. A customer support representative, for example, can view basic account information needed to assist users but cannot access payment details or administrative functions. A payment processor can access transaction data but not user messages or portfolio content.

Access to personal data is limited to authorized personnel only, and every access is logged with detailed audit trails recording who accessed what information, when, and for what purpose. These logs are regularly reviewed by our security team and are preserved for compliance and forensic analysis purposes. All administrative access to our systems requires multi-factor authentication (MFA), meaning that even if someone obtains a password, they cannot log in without also having physical access to the authorized user's authentication device (phone, hardware token, or biometric authenticator).

We conduct regular reviews of access privileges, typically quarterly, to ensure that permissions remain appropriate as job roles change or employees move to different positions. When an employee or contractor leaves Amoria Connekyt, their access is immediately revoked across all systems. This immediate revocation is automated through our identity management system to eliminate any window of vulnerability. Former employees cannot access company systems, databases, or user information after their departure.

3. Security Monitoring and Threat Detection
Security is not a one-time setup but an ongoing process requiring constant vigilance. We maintain 24/7 security monitoring with our Security Operations Center (SOC) using advanced Security Information and Event Management (SIEM) systems that aggregate logs from all our servers, applications, and network devices. These systems analyze millions of events daily, using machine learning and behavioral analysis to identify anomalies that might indicate suspicious activity or fraud attempts.

Our automated threat detection systems monitor for unusual patterns such as multiple failed login attempts from different locations, sudden spikes in data access, unusual transaction patterns, changes to critical system configurations, or communications containing known scam indicators. When suspicious activity is detected, alerts are immediately sent to our security team for investigation and response.

Data backup is critical for both disaster recovery and security. We maintain regular, automated backup procedures with secure off-site storage in geographically distributed data centers. This ensures that even in the event of hardware failure, natural disaster, ransomware attack, or other catastrophic event, your data can be recovered. Backups are encrypted, versioned (allowing recovery from specific points in time), and tested regularly to ensure they can be restored successfully when needed.

We maintain comprehensive incident response protocols and emergency procedures that define exactly how our team responds to different types of security events. These procedures are regularly tested through tabletop exercises and simulated security incidents to ensure our team can respond effectively under pressure. Response times, communication protocols, escalation procedures, and remediation steps are all clearly documented and rehearsed.

4. Data Storage Locations and Infrastructure
Your data may be stored within Rwanda or in other jurisdictions that offer equivalent or superior data-protection standards, including the European Union, Kenya, and South Africa. We carefully select data center locations based on multiple criteria: legal protections and privacy laws, physical security measures, technical infrastructure reliability, network connectivity and performance, compliance certifications (ISO 27001, SOC 2, etc.), and geographic distribution for disaster recovery.

All our data storage locations comply with recognized international data-protection safeguards and are operated by reputable infrastructure providers with proven track records in security and reliability. These facilities feature physical security including 24/7 surveillance, biometric access controls, security personnel, redundant power supplies, fire suppression systems, and environmental controls. Regular compliance audits are conducted both by internal teams and independent auditors to verify that security controls remain effective and that we continue meeting all regulatory requirements.

5. User Responsibilities and Shared Security
While we invest heavily in protecting your data, security is a shared responsibility. No system is 100% secure, and your own practices significantly impact your account's security. We strongly urge you to maintain strong, unique passwords that combine letters, numbers, and special characters. Passwords must be at least 8 characters long and should not be words found in dictionaries or contain personal information like names or birthdates. Longer passwords, 12 characters or more, are exponentially harder to crack.

Never reuse passwords across multiple services. If one site is compromised, attackers often try those credentials on other platforms. Consider using a reputable password manager to generate and store complex, unique passwords for each service you use. Keep your login credentials confidential and never share your account with others, even trusted friends or family members. Sharing accounts creates confusion about responsibility, compromises audit trails, and violates our terms of service.

Report suspicious activity immediately if you notice unfamiliar login locations, bookings you didn't make, messages you didn't send, or changes to your profile or settings. Quick reporting enables us to respond before significant damage occurs. The app also provides in-app tools to report content or users and to block or hide other users; we review reported content and take appropriate action to help keep the community safe. Use secure internet connections, especially when accessing your account or entering sensitive information. Public Wi-Fi networks are inherently insecure. If you must use them, employ a VPN (Virtual Private Network) to encrypt your traffic.

Protect your devices from malware by keeping operating systems and applications updated with the latest security patches, using reputable antivirus/anti-malware software, being cautious about clicking links or downloading attachments from unknown sources, and avoiding jailbreaking or rooting devices, which removes important security protections.

6. Security Incident Response and Breach Notification
Despite our comprehensive security measures, we recognize that no system is invulnerable. In the event of a data breach where unauthorized parties gain access to your personal information, we have robust procedures to respond quickly and transparently. Our incident response process follows these steps:

Immediate containment: Upon detecting a breach, we immediately take steps to contain it, preventing further unauthorized access by isolating affected systems, revoking compromised credentials, blocking attack vectors, and preserving evidence for forensic analysis.

Thorough investigation: We conduct detailed forensic analysis to understand what data was accessed, how the breach occurred, who was affected, whether data was actually exfiltrated or merely accessed, and what vulnerabilities were exploited.

User notification: We will notify affected users within 72 hours of confirming a breach, as required by Rwanda's Data Protection Law and GDPR. Notifications include what happened, what information was involved, what steps we're taking, what you should do to protect yourself, and contact information for questions or support.

We provide practical guidance on protective measures you should take, such as changing passwords, monitoring financial accounts for suspicious activity, being alert for phishing attempts that might exploit the breach, and considering credit monitoring or identity theft protection services if financial data was compromised.

Authority notification: We report significant breaches to relevant authorities including Rwanda's National Cyber Security Authority (NCSA), the Financial Intelligence Centre (FIC) if financial data is involved, and data protection authorities in other jurisdictions as required by applicable laws.

Remediation and improvement: Beyond immediate response, we take action to prevent recurrence by remediating the vulnerabilities that enabled the breach, implementing additional security controls, enhancing monitoring and detection capabilities, and updating incident response procedures based on lessons learned.

Our commitment to security is unwavering, but we also believe in transparency. If we make mistakes or face sophisticated attacks, we will communicate honestly with you, take responsibility, and work diligently to protect your interests and prevent future incidents.`
    },
    {
      id: 'how-we-use',
      title: 'How We Use Your Information',
      content: `Transparency about how we use your information is fundamental to building trust. The data we collect serves specific, legitimate purposes that directly benefit your experience on Amoria Connekyt. Below is a comprehensive explanation of how we utilize your information:

1. Account Management & Identity Verification
When you create an account, we use your personal information to set up and manage your user profile securely. This includes verifying your identity through our Know Your Customer (KYC) processes, which are essential for preventing fraud, ensuring platform security, and building a trustworthy community. We verify that all users meet our age requirements (18 years and above) to comply with legal regulations and protect minors. For photographers and creative professionals, we maintain and verify professional credentials, portfolio information, and service offerings to ensure clients can make informed decisions. Your account information enables us to provide personalized experiences, remember your preferences, and deliver relevant content tailored to your needs as either a client or creator.

2. Service Delivery & Facilitation
The core purpose of Amoria Connekyt is to connect clients with talented photographers and videographers. We use your information to facilitate these connections through intelligent matching algorithms that consider location, specialties, availability, budget, and project requirements. Your booking data helps us coordinate schedules, manage project timelines, and ensure smooth communication between parties. We enable secure digital workflows including contract management, milestone tracking, file sharing, and project collaboration tools. All communication conducted through our platform is stored to maintain transparency, provide reference during disputes, and ensure both parties have access to agreed terms and deliverables.

3. Payment Processing
Financial transactions are processed through our licensed third-party payment partner, XentriPay. Payments are completed on our website (connekyt.com) via XentriPay's secure checkout, and we do not collect or store your full card or mobile-money details in the app. We implement our innovative Hold & Release payment system, which protects both clients and creators by holding funds securely until services are completed and approved. This system uses your payment information to collect client payments upfront, hold 50% in secure escrow during project execution, and release the remaining balance upon successful completion. We maintain comprehensive transaction records and receipts for your reference, tax compliance purposes, and financial auditing. These records help resolve payment disputes, provide proof of income for creators, and ensure transparent financial operations throughout the platform.

4. Platform Improvement & Security
Your usage data and feedback are invaluable for continuously improving Amoria Connekyt. We analyze how users interact with our platform, which features are most popular, where users encounter difficulties, and what improvements would enhance the experience. This analysis guides our product development, helps us prioritize new features, and ensures we're building solutions that truly serve our community's needs. We use technical data and behavioral patterns to detect and prevent fraudulent activity, identify security threats, and protect users from scams or malicious actors. Our security systems monitor for unusual activity patterns that might indicate account compromise, payment fraud, or other security risks. We comply with Anti-Money Laundering and Counter-Terrorism Financing (AML/CTF) requirements by analyzing transaction patterns and reporting suspicious activities as required by Rwanda's Law No. 69/2018.

5. Communication & Support
We use your contact information to send important updates about your bookings, account activities, payment confirmations, and platform changes that affect your use of our services. When you reach out for customer support, we use your information and communication history to understand your issue, provide relevant assistance, and ensure problems are resolved effectively. With your explicit consent, we may send promotional materials about new features, special offers, photographer showcases, or platform updates that might interest you. You can opt out of promotional communications at any time while continuing to receive essential service-related messages. We also facilitate the verified ratings and review system, using your booking history to enable honest feedback that helps maintain quality standards across the platform.

6. Legal Compliance & Safety
We process your data to comply with various legal obligations and regulatory requirements. This includes adhering to Rwanda's Data Protection and Privacy Law No. 058/2021, which grants you specific rights regarding your personal information and imposes strict obligations on how we handle data. For international users, we comply with GDPR requirements and other applicable international standards. We maintain records necessary for tax compliance, financial reporting, and regulatory audits. When disputes arise between users, we use communication records, booking details, and transaction history to facilitate fair resolution through our mediation process. If legally required, we respond to law enforcement requests and cooperate with authorities investigating fraud, illegal activities, or other criminal matters. Throughout all these uses, our goal is to promote responsible creative collaboration, protect user safety, and maintain the integrity of the Amoria community.

Legal Basis for Processing:
Under Rwanda's Data Protection Law, we process your information based on several legal grounds: contractual necessity (to deliver the services you request), legitimate interests (for security, fraud prevention, and platform improvement), consent (for marketing and optional features), and legal obligation (for tax compliance, AML/CTF, and regulatory requirements).`
    },
    {
      id: 'data-retention',
      title: 'Data Retention',
      content: `Data retention is a careful balancing act between providing you with seamless service, meeting legal obligations, and respecting your privacy rights. We retain personal data only for as long as necessary to fulfill the purposes described in this policy or as required by law. Our approach is guided by principles of data minimization and purpose limitation. We don't keep information indefinitely "just in case," but rather maintain specific data for specific, justifiable periods.

1. Active Account Data
While your account remains active on Amoria Connekyt, we retain all information necessary to provide you with our services continuously and effectively. This includes your profile data (name, contact information, biography, preferences), transaction history (all bookings, payments, and financial records), communication records (messages exchanged with other users, support conversations), portfolio content (for creators: photos, videos, and other creative work samples), reviews and ratings (both given and received), and settings and preferences (language choices, notification preferences, privacy settings).

Retaining this information while your account is active enables us to provide personalized experiences, display accurate transaction histories for reference, maintain conversation context in communications, showcase your portfolio to potential clients, establish your reputation through accumulated reviews, and remember your preferences across sessions. This active data retention directly supports the platform functionality you rely on daily and creates continuity in your user experience.

2. Specific Retention Periods
Different types of data have different retention requirements based on their purpose and legal obligations. Understanding these specific retention periods helps you know how long various information remains in our systems:

User Account and Booking Data: We retain comprehensive account information and booking details for up to 5 years after your last account activity. This extended retention period serves multiple purposes: it enables you to reactivate dormant accounts without losing your history, supports tax compliance for both creators and clients who may need historical records, provides evidence for dispute resolution even after projects conclude, and meets legal requirements for maintaining business records. After 5 years of inactivity, account data is subject to permanent deletion unless longer retention is required by specific legal circumstances.

Transaction Records: All financial transaction records are retained for 7 years following the transaction date, as required by Rwandan tax law and international financial regulations. This retention period is not optional. It's mandated by law to support tax auditing, financial investigations, and regulatory compliance. These records include payment amounts, dates, parties involved, invoice details, payment method information (tokenized, not actual card numbers), and transaction confirmation numbers. Seven-year retention aligns with standard accounting practices globally and ensures we can respond to tax authority inquiries or audits even years after transactions occur.

Communication and Technical Logs: We retain communication logs, technical access logs, and security event logs for up to 12 months primarily for security auditing, fraud investigation, and platform debugging purposes. These logs help us detect security breaches, investigate suspicious activities, troubleshoot technical issues, and respond to support inquiries about past interactions. After 12 months, these logs are either deleted or aggregated into statistical summaries that don't contain personally identifiable information. This relatively short retention period balances security needs with privacy principles.

Analytics Data: We retain detailed analytics data (page views, feature usage, click patterns, session durations) for up to 2 years in identifiable form. After 2 years, this data is aggregated and anonymized, removing all personally identifiable information while preserving statistical insights about platform usage patterns. This anonymized data may be retained indefinitely to inform long-term product strategy, identify multi-year trends, benchmark performance improvements, and guide platform evolution. Anonymization is irreversible. Once data is properly anonymized, it can no longer be linked back to individual users.

Payment Records for AML/CTF Compliance: Beyond general transaction records, specific payment information required for Anti-Money Laundering and Counter-Terrorism Financing compliance is retained for 5 years following the last transaction. This includes KYC verification documents, beneficial ownership information for business accounts, risk assessment records, suspicious activity reports (if any), and enhanced due diligence documentation for high-risk accounts. This retention requirement comes from Rwanda's Law No. 69/2018 and international FATF standards, which mandate that financial service providers maintain comprehensive records to combat money laundering and terrorist financing.

3. Data Deletion and Anonymization
When data reaches the end of its retention period and is no longer needed for legal or operational purposes, we don't simply ignore it. We actively and securely delete it from all our systems through comprehensive data lifecycle management processes.

Personal information is securely deleted from production databases, backup systems, archived storage, log files, and any other locations where it may exist. Secure deletion means that data is not just marked as deleted (which would leave it recoverable) but is actually overwritten using industry-standard data sanitization techniques that make recovery impossible even with specialized forensic tools. For data stored on solid-state drives, we use secure erase commands; for magnetic media, we use multiple-pass overwriting; for cloud storage, we ensure cryptographic erasure where encryption keys are destroyed.

Some data, rather than being deleted, may be anonymized for statistical and research purposes. Anonymization is a process that removes all personally identifiable information in a way that cannot be reversed. For example, "User ID 12345 from Kigali viewed 15 photographer profiles on Tuesday" becomes "A user from Rwanda viewed 15 profiles on Tuesday." This anonymized data provides valuable insights for improving our platform without compromising individual privacy. Importantly, properly anonymized data is no longer considered personal data under most privacy regulations and can be retained indefinitely.

Backups present a special challenge for data deletion. We maintain encrypted backups in geographically distributed locations for disaster recovery purposes, and these backups are retained according to retention schedules (typically 30-90 days for incremental backups, up to 1 year for annual archives). When you request data deletion, we delete information from all active systems immediately, but backup deletion occurs as backup cycles naturally expire. We document all data deletion requests and ensure that if old backups are ever restored, the deleted data is not reintroduced to active systems.

Upon user request, data may be deleted earlier than standard retention periods dictate, unless retention is required by law. If you close your account and request deletion, we'll delete what we can immediately while retaining only what legal obligations require us to keep. We'll provide clear information about what is being deleted immediately versus what must be retained and for how long.

4. Legal Obligations and Exceptions
Sometimes our desire to delete data conflicts with legal requirements to retain it. In these situations, legal obligations take precedence, and we retain certain data longer than we otherwise would. These legal requirements come from multiple sources:

Regulatory Requirements: Financial regulators (BNR - National Bank of Rwanda), data protection authorities (NCSA - National Cyber Security Authority), and anti-money laundering authorities (FIC - Financial Intelligence Centre) all impose retention requirements. For example, financial transaction records must be available for inspection during tax audits, KYC documentation must be retained for AML investigations, and communication records may need to be preserved for regulatory compliance reviews. We cannot delete this information even if you request it, as doing so would violate legal obligations and expose us to significant penalties.

Ongoing Legal Proceedings or Investigations: If data is subject to a legal hold due to ongoing litigation, regulatory investigation, or law enforcement inquiry, we must preserve it until the matter is resolved and the hold is released. This might mean retaining data for months or even years beyond normal retention periods. We implement legal hold processes to identify and preserve relevant data, preventing its automatic deletion while legal matters are pending.

Legitimate Business Needs and AML/CTF Obligations: Beyond explicit legal requirements, we may retain data to protect legitimate business interests such as defending against legal claims (requiring evidence of contractual terms, communications, and transaction details), enforcing our terms of service (maintaining records of policy violations and enforcement actions), preventing fraud and abuse (retaining information about users who violated policies to prevent them from creating new accounts), and fulfilling AML/CTF obligations (ongoing monitoring of high-risk accounts, maintaining audit trails for regulatory reviews).

Tax Compliance and Financial Auditing: Tax authorities in Rwanda and other jurisdictions can audit businesses years after transactions occur. We must retain financial records long enough to respond to these audits, which explains the 7-year retention period for transaction records. This protects both Amoria Connekyt and our users (especially creators who may need historical income records for their own tax purposes).

5. Account Closure and Data Handling
When you decide to close your account or when we close an inactive account, data handling follows a careful, staged process that balances immediate deletion with necessary retention:

Upon account deletion or closure, we immediately take several actions: your profile is removed from public search results and the platform interface, your portfolio content is taken down and made inaccessible to other users, you stop receiving promotional communications (though we may send essential account closure confirmations), your login credentials are invalidated so you cannot access the platform, and your personal information is flagged for deletion from active systems.

Personal information removal within 30 days: Within 30 days of account closure, we delete most personal information from our active production systems, including contact information not needed for retained records, profile details and biographies, communication preferences and settings, device information and technical logs, and much of your activity history and analytics data. This 30-day window allows for a cooling-off period during which you could potentially reactivate your account if you closed it accidentally or changed your mind.

Information retained for legal compliance: Some information must be retained even after account closure for periods up to 5-7 years: transaction records and financial documentation (7 years for tax law compliance), KYC verification documents (5 years for AML/CTF compliance), records of any disputes, complaints, or policy violations, and basic account identifiers needed to prevent banned users from recreating accounts. This retention is minimal. We keep only what's legally required and delete everything else.

Anonymized data for analytics and platform improvement: We may retain anonymized, aggregated data indefinitely to understand platform usage trends, benchmark performance across time periods, guide strategic decisions about features and services, and measure the impact of changes and improvements. This data cannot be linked back to you as an individual and doesn't reveal personal information.

Transaction records and their legal retention: Transaction records involving your account remain in our systems for the full 7-year period required by law, even after account closure. These records contain information about bookings made or received, payment amounts and dates, parties involved (identified by anonymized IDs rather than names when possible), and invoice and receipt data. This retention protects all parties involved. Clients may need proof of payment for business expenses, creators need income documentation for tax purposes, and we need records for regulatory compliance and dispute resolution.

6. User Deletion Requests and Rights
You have the right to request deletion of your personal data, often called the "right to erasure" or "right to be forgotten" under privacy laws like GDPR and Rwanda's Data Protection and Privacy Law. However, this right is not absolute. It must be balanced against legal retention requirements and legitimate interests.

To request data deletion, contact us at privacy@amoriaglobal.com or legal@amoriaglobal.com with your request. Include your full name, registered email address, account username or ID (if known), a clear statement that you want your data deleted, and any specific types of data you're most concerned about. We will process deletion requests within 30 days as required by Rwandan law, though complex requests involving large amounts of data may take up to 60 days.

Our response will include confirmation of what data has been deleted immediately, explanation of what data must be retained due to legal requirements and for how long, information about anonymized data that no longer identifies you personally, and details about the backup deletion process. We aim for transparency. You'll know exactly what happened to your information.

Important limitations on deletion requests: We may decline or limit deletion requests when retention is required by law (financial records, KYC documents, etc.), necessary to complete transactions you initiated before requesting deletion, needed to defend against legal claims or comply with legal obligations, required to detect and prevent fraud or security threats, or when the data has been properly anonymized and no longer identifies you.

If your deletion request is refused or limited, we'll explain why, citing specific legal provisions or legitimate interests that require retention. You have the right to appeal this decision or file a complaint with Rwanda's National Cyber Security Authority (NCSA) if you believe your rights have been violated.

Our commitment: While we retain data when necessary, we're committed to deleting it as soon as we legally can. We regularly review retention requirements, implement automated deletion processes to ensure timely removal, maintain detailed records of what data is retained and why, and respect user privacy even in retained data through access controls, encryption, and purpose limitations.`
    },
    {
      id: 'user-rights',
      title: 'Your Rights and Choices',
      content: `Your personal data belongs to you, and you have significant rights regarding how it's collected, used, stored, and shared. Under Rwanda's Data Protection and Privacy Law No. 058/2021 and international regulations including GDPR, you are empowered with legal rights that give you control over your information. These aren't just theoretical concepts. They're enforceable rights that we take seriously and actively support you in exercising.

1. Right to Access (Right to Know)
The right to access is foundational. You have the right to know what personal data we hold about you and how we're using it. This transparency enables you to verify that we're handling your information properly and in accordance with our promises and legal requirements.

You have the right to access your personal data held by Amoria Connekyt, including all information in your profile, account details, transaction histories, messages and communications, booking records, reviews and ratings, KYC verification documents, and any other data associated with your account. You can request a comprehensive copy of your data in a portable, structured, commonly used, and machine-readable format such as JSON, CSV, or PDF, depending on the type of data. This format allows you to review the information yourself or transfer it to another service provider if you choose.

Beyond just receiving your data, you can view your data processing history to understand what activities we've performed with your information, including when it was collected, how it's been used, who it's been shared with, and what decisions or processes it's informed. We provide transparency about how your data is being used, explaining the purposes of processing, the legal basis for each use, retention periods, and your rights regarding the data.

Exercising your access right is straightforward: simply contact us at privacy@amoriaglobal.com with your request. We'll verify your identity (to ensure we're providing data to the right person) and typically respond within 30 days with a comprehensive data package. The first copy is provided free of charge; if you request multiple copies within a short timeframe, we may charge a reasonable administrative fee.

2. Right to Rectification/Correction
Your data should be accurate and up-to-date. Inaccurate information can lead to problems, from simple inconveniences like emails going to the wrong address to serious issues like payment failures or identity verification problems. The right to rectification ensures you can fix these issues promptly.

You can update your profile information at any time through your account settings without needing to contact us. This includes your name, contact details, biography, location, payment information, portfolio content (for creators), preferences and settings, and communication preferences. The platform provides user-friendly interfaces for these common updates, giving you immediate control.

For data that cannot be edited directly through your account interface (such as KYC verification documents, historical transaction records, or data that requires verification), you can request correction of any inaccurate or incomplete personal data by contacting our support team. We'll review your request, verify the corrected information if necessary (especially for identity or financial data), and update our records accordingly.

You can also request verification of data accuracy if you're unsure whether information in our systems is correct. We'll investigate and either confirm accuracy or make necessary corrections. Ensuring your information is up-to-date is beneficial for both you and us. It improves service quality, prevents transaction failures, ensures communications reach you, and maintains the integrity of our platform.

3. Right to Erasure ("Right to be Forgotten")
The right to erasure, often called the "right to be forgotten," allows you to request deletion of your personal data under specific circumstances. This right reflects the principle that you shouldn't be permanently identified by past activities or personal information when there's no legitimate reason to retain it.

You may request deletion of your personal data when: the data is no longer needed for its original purpose (for example, if you no longer use our services), you withdraw your consent and there's no other legal basis for processing, the data has been unlawfully processed or collected without proper authorization, erasure is required to comply with Rwandan law or other legal obligations, or you successfully object to processing and there are no overriding legitimate grounds for retention.

However, this right is not absolute. We may decline or limit deletion requests when retention is required by law (such as 7-year financial record retention for tax compliance), necessary to complete transactions you initiated, needed to establish, exercise, or defend legal claims, required to detect, prevent, or investigate fraud and security threats, or necessary for freedom of expression or information purposes where applicable.

When you request deletion, we'll carefully review the request, identify what data can be deleted immediately, explain what data must be retained and why (with specific legal citations), provide timelines for when retained data will be deleted, and confirm deletion of eligible data from all active systems. We strive for maximum transparency in this process, ensuring you understand exactly what's happening with your information.

4. Right to Restrict Processing
Sometimes you don't want your data deleted entirely, but you do want to limit how we use it. The right to restrict processing allows you to "freeze" your data, keeping it in our systems but preventing certain uses while issues are resolved.

You may request that we limit the processing of your personal data in certain cases: when you contest the accuracy of the data and want processing suspended while we verify it, when processing is unlawful but you prefer restriction over deletion, when we no longer need the data but you need it for legal claims, during dispute resolution while we investigate complaints or conflicts, or when you've objected to processing pending our verification of whether legitimate grounds override your objection.

When processing is restricted, we can still store the data but cannot perform other processing activities (like using it for marketing, sharing it with third parties, or making decisions based on it) without your consent, except for purposes you've approved, to establish or defend legal claims, to protect another person's rights, or for important public interests. You'll be notified before any restriction is lifted, giving you the opportunity to take further action if needed.

Restriction is useful when you're disputing something but want to preserve evidence, experiencing temporary issues with our service, or uncertain about whether you want full deletion. It provides a middle ground between continued processing and complete erasure.

5. Right to Data Portability
Data portability is a powerful right that prevents vendor lock-in and enables competition. It allows you to move your data from our platform to another service provider or to your own systems, facilitating your freedom to switch services without losing your information.

You have the right to obtain your personal data in a structured, commonly used, and machine-readable format that can be easily transferred to another platform. This includes data you've provided to us (profile information, uploaded content, messages, booking details) and data generated through your use of our services (transaction history, analytics data about your activity, reviews and ratings).

You can transfer this data to another controller (another platform or service provider) where technically feasible, or receive the data yourself in a format compatible with common software and platforms. We provide data in formats like JSON for technical users or developers, CSV for import into spreadsheets or databases, or PDF for human-readable documentation, depending on the data type and your preference.

Data portability empowers you to compare services, switch platforms without friction, backup your own data, use third-party tools to analyze your information, or simply maintain personal records of your activities. We support data portability not just because it's legally required, but because we believe users should have genuine control over their digital lives.

6. Right to Object
The right to object allows you to challenge processing activities that you find problematic, even if we have a legal basis for them. This right acknowledges that legal processing isn't always appropriate for every individual in every situation.

You can object to processing of your data for marketing purposes at any time, and we must stop immediately. You can also object to automated decision-making and profiling that significantly affects you, requesting human review and intervention. For data processing based on legitimate interests (our operational needs), you can object if you can demonstrate that your particular situation makes the processing inappropriate, and we must stop unless we can show compelling legitimate grounds that override your interests.

You can specifically object to marketing communications and promotional messages, profiling and targeted advertising, data sharing with partners for non-essential purposes, or other uses you find objectionable. When you object, we'll evaluate whether we can continue processing or must stop. For marketing, we always stop immediately. For other processing, we'll balance your rights against our legitimate needs.

To object, simply indicate what processing you're objecting to and why, especially if claiming that your particular situation makes processing inappropriate. We'll review your objection within 30 days and inform you of our decision, including reasons if we cannot comply with your objection and your options for appeal.

7. Rights in Automated Decision-Making and Profiling
Automated decision-making, where computers make significant decisions about you without human involvement, can be convenient but also risky if not properly controlled. You have the right not to be subject to decisions based solely on automated processing, including profiling, that significantly affects you.

At Amoria Connekyt, we use some automated systems for matching clients with photographers based on criteria, detecting potentially fraudulent transactions, recommending photographers or services, and analyzing usage patterns for improvements. However, we commit to ensuring that significant decisions affecting your account, payments, or rights always involve meaningful human review.

You have the right to obtain human intervention in automated decisions, express your point of view and contest the decision, and receive an explanation of how the automated decision was reached and what data influenced it. If an automated system denies you service, flags your account, or makes another significant adverse decision, you can request human review and provide context that the automated system might have missed.

We'll explain the logic involved in our automated systems (without revealing proprietary algorithms), the significance and consequences of the processing, and what factors most influenced the decision. This transparency allows you to understand and challenge decisions you believe are unfair or incorrect.

8. Withdrawal of Consent
When we process your data based on your consent (rather than legal obligation or contractual necessity), you have the absolute right to withdraw that consent at any time. Withdrawal is as easy as giving consent in the first place. No complex procedures or waiting periods.

You can withdraw consent for data processing where processing is based on consent for marketing communications and promotional messages, optional data uses beyond basic service delivery, profiling and targeted advertising that isn't essential to the service, location tracking and geolocation services, data sharing with partners for non-essential purposes, or participation in research or surveys.

Withdrawing consent doesn't affect the lawfulness of processing that occurred before withdrawal. We won't delete historical records or reverse actions we took when we had valid consent. However, we will stop the processing going forward. You can withdraw consent through your account settings for most purposes, by clicking unsubscribe links in marketing emails, or by contacting privacy@amoriaglobal.com for other consent-based processing.

Important distinction: Some processing doesn't require consent because it's necessary for our contract with you (like processing payment for bookings) or required by law (like retaining transaction records for tax compliance). You cannot withdraw "consent" for these activities because they're not based on consent. They're based on contractual or legal necessity. However, you always have the option to close your account if you no longer want the contractual relationship.

9. Marketing Communications and Preferences
We respect your communication preferences and make it easy to control what messages you receive from us. Marketing communications are always optional. You can use our platform fully without receiving promotional messages.

You can opt-out of marketing emails through multiple easy methods: clicking unsubscribe links in any marketing email for immediate removal from that specific list, adjusting preferences in your account settings to control different types of communications, or contacting support at privacy@amoriaglobal.com to request removal from all marketing communications.

When you opt out, we'll process your request within 48 hours for email communications, though you might receive messages already in transit. You'll continue to receive essential service communications such as booking confirmations, payment receipts, security alerts, account notifications, and policy updates, as these are necessary for the service regardless of marketing preferences.

We maintain separate lists for different communication types, so you can choose to receive some categories of messages but not others. For example, you might opt out of promotional offers but still receive newsletters about platform updates and new features.

10. How to Exercise Your Rights
Exercising your rights should be straightforward, not an obstacle course. We've designed simple, accessible processes for all rights requests.

To exercise any of these rights, please contact us at privacy@amoriaglobal.com or legal@amoriaglobal.com. Include your full name, registered email address associated with your account, account username or user ID if known, specific right you wish to exercise, clear description of what you're requesting, and any supporting information relevant to your request (especially for objections or rectification requests).

We will respond within the timeframe required by Rwandan law, typically 30 days for most requests. Complex requests involving large amounts of data or requiring detailed investigation may take up to 60 days, but we'll inform you if we need the extension and explain why. We'll verify your identity before responding to prevent unauthorized access to your data.

Our response will include confirmation of actions taken, explanation of any limitations or denials with legal justification, information about data retained and deletion timelines, guidance on next steps if applicable, and contact information for follow-up questions. Most rights requests are handled free of charge. We may charge a reasonable administrative fee for manifestly unfounded or excessive requests, particularly repeated requests for the same data.

11. Supervisory Authority and Complaints
If you believe your data protection rights have been violated or you're dissatisfied with how we've handled your rights request, you have the right to file a complaint with the supervisory authority. In Rwanda, the relevant authority is the National Cyber Security Authority (NCSA).

You can contact the NCSA Data Protection Office in Kigali, Rwanda. Their website is www.ncsa.gov.rw, where you'll find complaint forms, contact information, and guidance on the complaint process. NCSA has the authority to investigate complaints, order corrective actions, impose penalties for violations, and provide binding decisions on data protection matters.

When filing a complaint, provide detailed information about the alleged violation, documentation of your attempts to resolve the issue with us, explanation of how your rights were violated, and desired outcome or remedy. The NCSA will review your complaint, potentially investigate our data practices, and may contact us for our response before making a determination.

We encourage you to contact us directly first before escalating to the NCSA, as we're committed to resolving issues cooperatively and may be able to address your concerns quickly. However, contacting us first is not required. You have the absolute right to file a complaint with the supervisory authority at any time.

For international users, additional supervisory authorities may have jurisdiction: EU citizens can complain to their national data protection authority under GDPR, UK citizens can contact the Information Commissioner's Office (ICO), and other jurisdictions have their own data protection authorities with similar powers.

Your rights are not just words on paper. They're enforceable legal protections. We're committed to honoring them fully, responding promptly to requests, and maintaining the highest standards of data protection and user respect.`
    },
    
    {
      id: 'cookies-tracking',
      title: 'Cookies and Tracking',
      content: `Cookies and similar tracking technologies are essential tools that enable modern websites and applications to function smoothly while providing personalized, efficient user experiences. Understanding how we use these technologies helps you make informed decisions about your privacy and control how your data is collected.

1. What Are Cookies and Why We Use Them
Cookies are small text files stored on your device (computer, smartphone, tablet) when you visit our platform. Despite their somewhat ominous-sounding name, cookies are simply data storage mechanisms that help websites remember information about your visit. Think of them as digital sticky notes that remind our servers who you are, what you prefer, and where you left off during your last session.

These small data files serve numerous important purposes: they keep you logged in as you navigate between pages (without cookies, you'd have to log in again every time you clicked a link), remember your preferences and settings (language choice, display options, notification preferences), enable shopping cart or booking functionality (tracking what services you've selected), provide security by detecting suspicious login patterns or preventing certain attacks, help us understand how people use our platform so we can improve it, and enable personalized experiences based on your interests and behavior.

Without cookies, websites would be much less functional and convenient. You'd lose your place constantly, have to re-enter information repeatedly, and receive generic experiences that don't account for your preferences. However, we also recognize that cookies involve data collection, which is why we're transparent about how we use them and give you control over non-essential cookies.

2. Types of Cookies We Use
We use several categories of cookies, each serving different purposes. Understanding these categories helps you decide which cookies you're comfortable accepting:

Essential Cookies (Strictly Necessary): These cookies are absolutely required for our platform to function properly. Without them, core features simply wouldn't work. Essential cookies handle authentication (keeping you logged in, verifying your identity, managing your session), security (preventing cross-site request forgery attacks, detecting suspicious activity, protecting against unauthorized access), basic platform operations (page navigation, form submission, error handling), and account management (accessing your profile, viewing your dashboard, managing settings).

We cannot provide our service without these essential cookies, which is why they're typically exempt from cookie consent requirements under privacy laws. They're necessary to fulfill our contract with you. You cannot disable essential cookies while using our platform, though you can delete them after closing your session through your browser settings.

Analytics and Performance Cookies: These cookies help us understand how users interact with our platform, identify areas for improvement, and measure the effectiveness of changes. Analytics cookies track usage patterns including which pages are most visited, how long users spend on different sections, where users encounter difficulties or drop off, what features are most popular, and how users navigate through the platform.

This information is typically collected in aggregate form, meaning we see overall trends rather than tracking specific individuals in detail. For example, "50% of users visit the photographer search page within their first five minutes" rather than "John Smith from Kigali visited the search page at 2:37 PM." These insights guide our product development, helping us prioritize features that users actually want and fix issues that cause frustration.

Preference and Functionality Cookies: These cookies remember your choices and settings to provide a personalized experience tailored to your preferences. They store information about your language preferences (English, French, Kinyarwanda, etc.), display settings and customization options, notification preferences (how and when you want to be contacted), recently viewed photographers or portfolios, saved searches or bookmarked profiles, and communication preferences.

Preference cookies enhance your experience by eliminating the need to repeatedly configure settings every time you visit. If you disable these cookies, you'll still be able to use the platform, but it will reset to default settings with each visit, which can be inconvenient.

Marketing and Advertising Cookies: These cookies track your interests and browsing behavior to deliver targeted advertising and promotional content that's relevant to you. They're used to display personalized ads on our platform and other websites, limit how many times you see the same advertisement, measure advertising campaign effectiveness, and create audience segments for targeted marketing.

Marketing cookies are the most privacy-sensitive category because they track behavior across sessions and sometimes across websites. We only deploy marketing cookies with your explicit consent. They're not activated unless you specifically agree to them through our cookie banner or preference center. You can withdraw consent at any time, and we'll stop collecting data through these cookies going forward.

Social Media Cookies: If you interact with social media features on our platform (like sharing a photographer's portfolio on Facebook or using social login), cookies from those social networks may be placed on your device. These cookies enable social sharing functionality, facilitate social login options, track social media engagement, and may be used by the social networks for their own purposes including advertising. Social media cookies are controlled by the respective social networks (Facebook, Instagram, LinkedIn, etc.), and their privacy policies govern how they use this data.

3. Third-Party Cookies and Services
In addition to cookies we set directly (first-party cookies), our platform uses cookies from trusted third-party services (third-party cookies). These external services provide specialized functionality that enhances your experience:

Google Analytics: We use Google Analytics, the world's most widely used web analytics service, for detailed usage analysis and performance monitoring. Google Analytics cookies track metrics like page views, bounce rates, user demographics, traffic sources, conversion rates, and user flow through the platform. This data helps us understand which features are succeeding, where users struggle, and how to improve the overall experience. Google Analytics data is typically aggregated and anonymized after a certain period. You can opt out of Google Analytics through browser extensions or our cookie preference center.

Payment Processor Cookies: Our payment partner (XentriPay) uses cookies for transaction security and fraud prevention. These cookies help verify that you're the legitimate account holder, detect potentially fraudulent transaction patterns, maintain payment session security, and enable seamless checkout experiences. Payment security cookies are typically categorized as essential because they're necessary for secure financial transactions.

Social Media Platform Cookies: When you use social features on our platform or log in via social media accounts, cookies from platforms like Facebook, Instagram, LinkedIn, and Twitter/X may be set. These cookies enable social login without separate password creation, allow sharing content to your social feeds, display social engagement metrics (likes, shares), and may personalize social media ads based on your platform activity. You can control social media cookies through your accounts on those platforms or by avoiding social features on our site.

Video Hosting and Streaming Services: We host platform media and live streams through Cloudflare (Cloudflare Stream). When videos or live streams are embedded, cookies from our media provider may be placed to enable video playback functionality, remember playback preferences (volume, quality), and track viewing statistics. Where a photographer embeds video from an external service they use (such as YouTube or Vimeo), that service's cookies may also be placed and are governed by its own privacy policy.

Advertising Partners: With your consent, we may work with advertising partners who use cookies to deliver targeted campaigns and measure advertising effectiveness across the web. These cookies create behavioral profiles, track conversions from ads to bookings, enable retargeting (showing ads to people who visited our platform), and measure return on advertising investment.

4. Managing and Controlling Cookies
We believe you should have meaningful control over cookies and tracking technologies. We provide multiple ways to manage cookie settings according to your preferences:

Browser Settings: All modern web browsers allow you to control cookies through built-in settings. You can block all cookies (though this may break website functionality), block only third-party cookies while allowing first-party cookies, delete cookies after each browsing session, or set exceptions for specific websites. Access cookie settings through your browser's privacy or security menu. Specific instructions vary by browser (Chrome, Firefox, Safari, Edge), but all provide similar controls.

Our Cookie Preference Center: We provide a cookie preference center accessible through your account settings where you can view all cookie categories we use, enable or disable non-essential cookies by category, see details about specific cookies including their purpose and duration, update your choices at any time, and export your cookie preferences. Changes in our cookie preference center are applied immediately and respected across all future sessions.

Third-Party Opt-Out Tools: For third-party advertising cookies, you can use industry opt-out tools like the Digital Advertising Alliance's opt-out page (optout.aboutads.info), Network Advertising Initiative's opt-out page (optout.networkadvertising.org), or browser extensions that block tracking cookies. Note that opting out typically means you'll still see ads, but they won't be personalized based on your interests.

You may disable non-essential cookies via your browser or app settings without losing access to our core platform functionality. However, some features may not work properly if essential cookies are disabled. For example, you won't be able to stay logged in, and we won't remember your preferences between sessions.

5. Do Not Track and Global Privacy Control
Do Not Track (DNT) is a browser setting that signals your preference not to be tracked for advertising purposes. While DNT is supported by most browsers, there's no universal standard for how websites should respond to it, leading to inconsistent implementation across the web.

We respect Do Not Track signals where technically feasible. When we detect a DNT signal from your browser, we disable non-essential tracking cookies, limit data sharing with advertising partners, and reduce behavioral profiling. However, essential cookies necessary for platform functionality will still be set because they're required for the service to work.

We also respect Global Privacy Control (GPC), a newer and more specific signal that communicates your privacy preferences. GPC is more comprehensive than DNT, signaling opt-out choices for data sales, data sharing, and targeted advertising. When we detect GPC signals, we treat them as binding privacy preferences and configure our cookie usage accordingly.

6. Cookie Duration and Expiration
Cookies have limited lifespans, after which they automatically expire and are deleted. Understanding cookie duration helps you know how long information is retained:

Session Cookies: These temporary cookies exist only during your browsing session and are automatically deleted when you close your browser. Session cookies are typically used for authentication and basic functionality, ensuring that your login persists as you navigate between pages but doesn't remain after you leave.

Persistent Cookies: These cookies remain on your device for a specified period, even after you close your browser. They're used to remember preferences across sessions, enable "remember me" login functionality, track analytics over time, and maintain advertising profiles. Persistent cookies we use typically expire within 1-2 years, though some may have shorter or longer lifespans depending on their purpose. You can manually delete persistent cookies through your browser settings at any time.

Cookie expiration is an important privacy protection. Even if you never manually clear cookies, they eventually expire and are removed automatically. This prevents indefinite tracking and ensures that old data doesn't accumulate endlessly.

7. Updates and Changes to Cookie Usage
Technology evolves, and so do our cookie practices. As we adopt new tools, respond to changing regulations, or improve our platform, we may update our cookie usage. When we make significant changes to our cookie practices, we'll communicate these updates through email notifications to registered users, prominent notices on our website or app when you first visit after the change, and updates to this Cookie Policy with revised "last updated" dates.

We'll also provide updated consent options if we introduce new cookie categories or purposes that weren't previously covered by your consent. You'll have the opportunity to review and approve (or decline) these new uses before they're activated. Minor technical changes that don't affect privacy (like updating specific cookie names or switching to a different analytics provider with equivalent privacy practices) may not trigger individual notification, but will still be reflected in this policy.

Our commitment to transparency means you'll always have clear information about what cookies we use, why we use them, and how to control them. Cookies are powerful tools that enhance your experience, but that power must be balanced with respect for your privacy and choices.`
    },
    {
      id: 'third-party-links',
      title: 'Third-Party Services',
      content: `Modern digital platforms rarely operate in isolation. Amoria Connekyt integrates with carefully selected third-party services and may contain links to external websites to provide comprehensive functionality, enhanced features, and seamless user experiences. Understanding these third-party relationships helps you make informed decisions about your data and privacy.

1. Third-Party Integrations and Service Providers
Amoria Connekyt partners with reputable third-party service providers who help us deliver reliable, feature-rich platform experiences. These integrations are not arbitrary. Each provider is carefully vetted and selected based on specific criteria:

Payment Gateway (XentriPay): This licensed, regulated payment processor handles all financial transactions on our platform. Payments are completed on our website (connekyt.com) via XentriPay's secure checkout; the app itself does not collect your card or mobile-money details. XentriPay provides secure payment processing with PCI DSS compliance, fraud detection and prevention systems, multiple payment method support (cards, mobile money, bank transfers), real-time transaction processing, and reliable fund transfers. We chose XentriPay for its proven track record, strong security credentials, regulatory compliance with local and international financial standards, and excellent reliability and uptime. When you make or receive payments, your financial data is transmitted directly to XentriPay using encrypted connections. We never see or store your complete card or mobile-money details.

Video Hosting and Streaming (Cloudflare Stream): To enable photographers to showcase their work through video portfolios and to allow live event streaming (including user self-streaming), we integrate with Cloudflare (Cloudflare Stream). This service provides high-quality video streaming with adaptive bitrate encoding, reliable content delivery networks (CDNs) for fast loading worldwide, video analytics and engagement metrics, and secure storage for large video files. This means videos and live streams on our platform are served from Cloudflare's infrastructure, which may set its own cookies and process media data according to its privacy policy.

Push Notifications (Expo): To send you booking updates, messages, and other alerts, we use Expo's push notification service. When you enable notifications, a device push notification token is generated and used to deliver notifications to your device. You can disable push notifications at any time through your device settings.

Analytics and Performance Monitoring Tools: We use analytics platforms, primarily Google Analytics, to understand how users interact with our platform and identify opportunities for improvement. These tools provide detailed insights into user behavior patterns, page performance and loading times, user demographics and geographic distribution, traffic sources and marketing campaign effectiveness, and conversion funnels and dropout points. Analytics tools use cookies and may collect IP addresses, device information, and browsing patterns. While this data helps us improve our service, we also recognize it involves tracking, which is why we provide opt-out mechanisms and respect Do Not Track signals.

Identity Verification Partners: To comply with KYC (Know Your Customer) requirements and prevent fraud, we work with specialized identity verification services. These partners provide document authenticity verification using advanced image analysis, biometric verification comparing photos to ID documents, database cross-referencing to validate information accuracy, and fraud detection identifying forged or manipulated documents. When you submit identification documents for verification, they're securely transmitted to these partners who analyze them and report verification results back to us. The verification partners are bound by strict confidentiality agreements and data protection obligations.

Cloud Hosting Providers: Our platform runs on secure cloud infrastructure provided by reputable hosting companies. These providers supply scalable server infrastructure in multiple geographic locations, redundant data storage with automated backups, network security including DDoS protection and firewalls, and technical support and maintenance. Cloud providers have physical access to the servers where data is stored, which is why we choose providers with strong security credentials, compliance with international standards (ISO 27001, SOC 2, etc.), data centers in jurisdictions with robust data protection laws, and contractual commitments to data security and confidentiality.

All these partners are carefully selected and required to follow strict data-protection standards complying with Rwanda's Data Protection and Privacy Law (DPPL), European Union's General Data Protection Regulation (GDPR), ISO 27001 (Information Security Management), and ISO 27701 (Privacy Information Management) standards. We conduct due diligence before engaging any service provider, reviewing their security practices, privacy policies, compliance certifications, reputation and track record, and financial stability. We maintain contractual agreements that obligate partners to protect user data, limit data use to specified purposes, implement appropriate security measures, comply with applicable privacy laws, and notify us of any security incidents.

2. External Websites and Links
Our platform may contain links to external websites and services not operated by us. These links serve various purposes and connect you to extended resources:

Photographer Personal Websites and Portfolios: Many photographers maintain their own websites showcasing extended portfolios, client testimonials, pricing packages, and contact information beyond what they include in their Amoria Connekyt profiles. When photographers provide links to external portfolios, these direct you to independently operated websites over which we have no control. These external sites may have different privacy practices, security standards, and terms of service than Amoria Connekyt.

Social Media Profiles: Photographers and clients may link to their professional social media profiles (Instagram, Facebook, LinkedIn, Twitter/X, Pinterest, Behance) to display their work, demonstrate their reputation, or enable additional contact methods. Social media platforms have their own privacy policies, data practices, and terms of service. When you visit these external profiles, you're subject to the rules and practices of those social networks, not Amoria Connekyt.

Payment Processor Sites: During checkout or payout processes, you may be redirected to our secure web checkout on connekyt.com, which is hosted by our payment partner (XentriPay). These redirects are necessary for secure payment processing and allow the payment partner to handle sensitive financial data directly. You'll typically notice a URL change indicating you're on our secure checkout or the payment processor's domain. These pages are governed by the payment processor's privacy policy and security practices.

Partner Platforms and Services: We may link to partner platforms that provide complementary services such as event management tools, photography equipment marketplaces, professional development resources, and industry associations or organizations. These partnerships are designed to provide additional value to our community, but each partner operates independently with its own policies and practices.

Educational and Resource Links: Our help center, blog, or support documentation may link to external resources including photography tutorials and guides, legal and regulatory information, technology and security resources, and industry news and best practices. These external resources are provided for informational purposes, but we cannot control their content or guarantee their continued availability or accuracy.

3. No Responsibility for External Sites and Limitations
While we strive to link only to reputable, trustworthy sites, we cannot control external websites or guarantee their practices. Therefore, we explicitly disclaim responsibility for several aspects of third-party sites:

Privacy Practices of External Sites: Each website has its own privacy policy governing how they collect, use, store, and share personal information. These policies may be more or less protective than our own. We cannot control or ensure compliance with privacy standards on external sites. Before providing personal information to any external website, you should review their privacy policy to understand their practices.

Content Accuracy of Linked Websites: We do not verify the accuracy, completeness, or reliability of content on external websites. Information on linked sites may be outdated, inaccurate, or misleading. External websites' content does not necessarily reflect Amoria Connekyt's views, positions, or recommendations. You should critically evaluate information from external sources and verify important details through multiple sources.

Security of Third-Party Platforms: We cannot guarantee the security practices of external websites. Third-party sites may have vulnerabilities, inadequate encryption, or poor security practices that put your data at risk. External sites may be compromised or impersonated by malicious actors. We're not responsible for security breaches, data leaks, or other security incidents on external platforms.

Terms and Conditions of External Services: Each external service has its own terms of service, user agreements, and legal policies. These terms may differ significantly from Amoria Connekyt's terms. By using external services, you agree to their terms and conditions, not just ours. We're not responsible for disputes arising from your use of external services.

4. User Discretion and Best Practices
When visiting external sites or using third-party integrations, you should exercise appropriate caution and follow security best practices:

Review Their Privacy Policies Carefully: Before providing personal information to any external site, take time to read their privacy policy. Understand what data they collect, how they use it, who they share it with, and how long they retain it. Pay special attention to sections about data sharing, cookies, and user rights.

Understand Their Data Practices: Look for clear explanations of data security measures, information about compliance certifications or standards, details about international data transfers if applicable, and procedures for exercising privacy rights (access, deletion, correction). Be wary of sites with vague or absent privacy policies.

Exercise Caution with Personal Information: Only provide information that's necessary for the specific service, avoid sharing sensitive data unless absolutely required and the site is trustworthy, use different passwords for different sites to limit damage from breaches, and be skeptical of requests for excessive personal information.

Use Secure Connections: Verify that external sites use HTTPS (look for the padlock icon in your browser's address bar), avoid entering sensitive information over public Wi-Fi networks unless using a VPN, ensure your browser is updated with the latest security patches, and be cautious of security warnings from your browser.

Verify Authenticity Before Sharing Sensitive Data: Check that URLs match the legitimate domain of the service you intend to use, watch for typosquatting or subtle misspellings in domain names, be wary of unexpected redirects or pop-ups requesting information, and when in doubt, navigate directly to the site rather than clicking links.

5. Social Media Integration
We integrate with social media platforms to enable convenient features and expand functionality:

Profile Authentication and Social Login: We offer social login options allowing you to create an account or log in using existing social media credentials (Facebook, Google, LinkedIn, Apple). This convenience means you don't need to create yet another username and password, and registration is faster with pre-filled information from your social profile. However, social login grants Amoria Connekyt limited access to your social media profile information as permitted by the platform and authorized by you. This typically includes basic profile information (name, email, profile picture) but not private messages or full friend lists. You control what information is shared through permissions granted during the social login process.

Content Sharing and Portfolio Display: Photographers can showcase their Instagram feeds, share booking confirmations to social media, display social proof (follower counts, engagement metrics), and enable clients to share their experiences or photos. These integrations may involve social media widgets or embedded content that enables social platforms to see that you visited our site (even if you don't actively interact with the widget) and potentially track your browsing activity across multiple sites.

Social Features and Community Building: Social integrations enable users to follow photographers, share profiles or portfolios with friends, comment and engage with content, and participate in community discussions. These social features enhance community engagement but also involve data sharing with social platforms.

These integrations are subject to the privacy policies of respective platforms (Meta/Facebook, Google, LinkedIn, Apple, Twitter/X, Instagram, etc.). Each platform has its own rules about data collection, usage, and sharing. We recommend reviewing the privacy policies of any social media platforms you use in conjunction with Amoria Connekyt. You can typically control social media integrations through your social media account settings, where you can revoke access permissions, limit data sharing, or disable social features.

6. Photographer External Content and Portfolios
Photographers using Amoria Connekyt may link to external portfolios, websites, or platforms where they showcase additional work. This might include personal photography websites, Behance or 500px portfolios, YouTube or Vimeo channels, Instagram or Pinterest galleries, and online stores or marketplaces.

We do not control or endorse external photographer content. The presence of such links doesn't imply our approval, recommendation, or quality guarantee of the photographer or their external content. External content may not adhere to our community guidelines or quality standards. Users access photographer external content at their own discretion and risk.

If you engage photographers through external channels after connecting on Amoria Connekyt, you lose the protections of our platform including our Hold & Release payment system, dispute resolution services, review and rating system, and secure communication channels. We strongly encourage conducting all booking negotiations and transactions through Amoria Connekyt to maintain these protections.

7. Reporting Concerns and Issues
If you encounter inappropriate, suspicious links, or experience issues with third-party services, please report them to us immediately:

Report through our in-app reporting feature or email support@connekyt.com with details about the concerning link or service, description of the issue (suspected phishing, malware, inappropriate content, security concern), location where you encountered the link (which page, user profile, message), and any relevant screenshots or evidence.

We take reports seriously and will investigate promptly, remove links that violate our policies or pose security risks, warn users about problematic external services, and potentially suspend accounts of users deliberately sharing malicious links. Your vigilance helps protect the entire community from security threats and fraudulent services.

Our Third-Party Philosophy: We believe in leveraging specialized services that excel in their domains rather than trying to build everything ourselves. This partnership approach enables us to offer better payment processing, security, video hosting, and other features than we could develop in-house. However, we carefully vet partners, maintain strong contractual protections, and remain transparent about these relationships so you can make informed choices about your data and privacy.`
    },
    {
      id: 'childrens-privacy',
      title: "Children's Privacy",
      content: `Protecting children online is a responsibility we take with the utmost seriousness. Our services are designed exclusively for users aged 18 and above. Amoria Connekyt is committed to protecting the privacy of minors and strictly complying with applicable children's privacy laws. This isn't just about legal compliance. It's about ensuring that young people are protected from inappropriate content, predatory behavior, and situations they're not mature enough to navigate safely.

1. Age Requirements and Restrictions
Amoria Connekyt is explicitly not intended for users under 18 years old. This age restriction exists for multiple important reasons: legal contracts require adult capacity (minors generally cannot enter binding contracts under most jurisdictions' laws), professional transactions involve financial relationships inappropriate for minors, the platform facilitates business relationships that assume adult judgment and responsibility, content may include topics, imagery, or discussions unsuitable for children, and protecting minors from potential exploitation or inappropriate contact is paramount.

During registration, users must explicitly confirm that they meet our age requirements by checking a box affir

ming they are 18 years or older. This isn't just a formality. Providing false information about age is a violation of our terms of service and grounds for immediate account termination. Our identity verification (KYC) process serves as an additional enforcement mechanism, as government-issued IDs clearly display birthdates, allowing us to verify that users meet age requirements before they can engage in financial transactions or access certain features.

We do not knowingly collect, process, or retain personal data from anyone under 18 years old. If we discover through KYC verification, user reports, or other means that a user is underage, we take immediate action to protect the minor and comply with children's privacy laws.

2. Discovery and Parental Notification
If we discover or are notified that a user is under 18 years old, we follow a strict protocol designed to protect the minor's privacy while complying with legal requirements:

The account is immediately suspended to prevent further data collection and to protect the minor from potential contact or transactions. We attempt to notify parents or guardians if we have sufficient contact information, though this isn't always possible if the minor used false information during registration. The notification includes information about the suspension, why age restrictions exist, what data was collected, and what actions we're taking to delete it.

All personal information associated with the underage account is deleted promptly and permanently from all our systems including production databases, backup systems, log files, and cached data. This deletion is comprehensive and irreversible, ensuring that the minor's information doesn't remain in our systems. We document the incident internally for compliance purposes (without retaining the minor's personal data) and, if circumstances suggest potential harm to the child or deliberate exploitation, we may report the situation to relevant authorities as required by law.

3. Legal Compliance Framework
Our children's privacy practices comply with a comprehensive framework of laws and regulations:

Rwanda's Data Protection and Privacy Law No. 058/2021 includes specific provisions for protecting minors' personal data, requiring heightened consent requirements for processing children's information, limitations on data collection and use, and special obligations when minors' data is involved. We implement these requirements by categorically excluding minors from our platform.

Children's Online Privacy Protection Act (COPPA) is a United States federal law requiring websites and online services to obtain verifiable parental consent before collecting personal information from children under 13. While COPPA's age threshold is lower than ours, we comply with its principles by not targeting or knowingly collecting information from anyone under 18, thereby exceeding COPPA's minimum requirements.

GDPR Provisions for Minors include enhanced protections for children under 16 (or younger, depending on the EU member state). GDPR requires verifiable parental consent for processing children's data, mandates clear, child-appropriate language in privacy notices directed at children, and imposes stricter limitations on data collection and profiling of minors. Again, by excluding all users under 18, we exceed these requirements.

Similar international regulations in jurisdictions worldwide recognize that children deserve special privacy protections. Our blanket 18-and-over policy ensures compliance with these varied regulations regardless of where our users are located.

4. No Targeting of Minors
We do not market to children or minors in any way. Our marketing efforts are directed exclusively at adult professionals (photographers and videographers) and adult clients seeking professional services. Our advertising placement avoid channels primarily frequented by minors, use age-targeting features in advertising platforms to exclude underage audiences, employ content appropriate for adult business contexts, and do not use themes, characters, or messaging designed to appeal to children.

Our services are designed exclusively for adult professionals and clients conducting business transactions. The platform's features and functionality assume adult decision-making capacity, financial independence, and professional responsibility. Content shared on our platform (including portfolio work, communications, and transactions) is appropriate for business and professional purposes only. Platform features inherently require users to be 18 or older because they involve legally binding contracts, financial transactions, and business relationships that minors cannot legally enter.

5. Reporting Underage Users
Parents, guardians, educators, or other concerned individuals who believe a user is under 18 are encouraged to report this to us immediately. Reports help us enforce age restrictions and protect minors from inappropriate platform use.

To report an underage user, email us at privacy@amoriaglobal.com or legal@amoriaglobal.com with the subject line "Underage User Report." Include the account username or profile link, explanation of why you believe the user is underage, relationship to the minor (if applicable), and any supporting evidence (though please don't share private documents without proper authority).

We treat all reports confidentially and investigate promptly. If we confirm that a user is underage, we'll take immediate action to suspend the account and delete associated data. Parents or guardians may request immediate deletion if they discover their child created an account, even if we haven't independently discovered it yet. We'll honor such requests expeditiously, typically within 24-48 hours.

6. Educational and Institutional Use
Some photography and videography students over 18 may use our platform as part of their professional education and portfolio development. For users aged 18 or older enrolled in educational institutions, we don't require separate parental consent because they meet our age requirements and are legally adults in most jurisdictions.

However, we recognize that some educational institutions may have their own policies requiring parental notification or consent for students' use of professional platforms as part of coursework. These institutional requirements are between the student, their parents, and the educational institution. They're outside our direct control. We cooperate with legitimate educational institution requests for information about our privacy practices and age verification procedures.

7. Comprehensive Data Deletion
When data from an underage user is identified, our deletion process is thorough and immediate:

Data is deleted immediately and permanently from all active production systems where it's used for operational purposes. It's removed from backup systems according to backup rotation schedules, typically within 30-90 days as backups naturally expire. Data in log files and audit trails is scrubbed or anonymized so the minor cannot be identified. Any documents or images uploaded by the minor are permanently deleted from file storage systems.

If the situation suggests potential child exploitation, grooming, or other serious concerns, we report to relevant authorities as required by law, which may include Rwanda's National Cyber Security Authority (NCSA), Rwanda Investigation Bureau (RIB), or international law enforcement if evidence suggests crimes involving minors. Parents or guardians are notified of the deletion once it's completed, with confirmation that the minor's information has been removed from our systems.

Our Commitment: Amoria Connekyt is a platform for adults conducting professional business. We don't want minors on our platform, not because we don't value young people, but because we recognize they deserve different protections and our platform isn't designed for their needs or safety. We'll continue enforcing age restrictions vigilantly and cooperating with parents, guardians, and authorities to protect minors online.`
    },
    {
      id: 'international-transfers',
      title: 'International Data Transfers',
      content: `In today's interconnected digital ecosystem, data frequently crosses international borders to enable global services and seamless user experiences. Amoria Connekyt operates as a platform that connects creative professionals and clients across Africa and beyond, which means your personal data may be transferred to, stored in, or accessed from locations outside Rwanda. We take international data transfers seriously and implement comprehensive safeguards to ensure your information receives consistent protection regardless of where it's processed.

1. Data Transfer and Storage Locations
Modern cloud infrastructure and global service providers enable reliable, high-performance platforms but also mean that data often resides in multiple geographic locations. Understanding where your data goes and why helps you make informed decisions about using our services.

Your personal data may be transferred to and stored in several jurisdictions beyond Rwanda's borders, specifically locations within the European Union (including Ireland, Germany, Netherlands, and France), where many cloud providers operate data centers with robust privacy protections under GDPR. Data may also be stored in Kenya, which hosts major African cloud infrastructure and has data protection laws aligned with international standards, and South Africa, another key African technology hub with comprehensive data protection legislation (POPIA - Protection of Personal Information Act).

We carefully select storage locations based on rigorous criteria: the jurisdiction must have recognized data protection laws that provide equivalent or superior protections to Rwanda's Data Protection and Privacy Law No. 058/2021. We evaluate physical security of data centers, including access controls, surveillance, environmental protections, and disaster recovery capabilities. Technical infrastructure quality matters, including network connectivity, uptime guarantees, redundancy systems, and data center certifications (ISO 27001, SOC 2, etc.). We also consider legal stability and respect for rule of law, ensuring that governments in these jurisdictions respect privacy rights and follow due process when requesting data access.

Our data distribution strategy employs geographic redundancy for disaster recovery, meaning if one data center experiences failure or disaster, your information can be recovered from backup locations in different geographic regions. We optimize performance by storing data closer to where users are located, reducing latency and improving load times. Specialized service providers handle specific functions. Payment processors operate in jurisdictions where they're licensed, identity verification services may process documents in secure facilities optimized for such processing, and analytics platforms aggregate data in their own cloud infrastructure.

It's important to understand that international data transfers don't mean your information is less protected. In fact, by leveraging world-class infrastructure in jurisdictions with strong legal protections, we often enhance security beyond what might be possible using only domestic infrastructure. However, we recognize that cross-border transfers introduce complexity, which is why we implement multiple layers of legal and technical safeguards.

2. Legal Safeguards and Compliance Framework
International data transfers are subject to strict legal requirements designed to ensure that data protection doesn't end at national borders. We comply with a comprehensive framework of international data transfer mechanisms:

Rwanda's Data Protection and Privacy Law No. 058/2021 governs how Rwandan entities transfer personal data internationally. Under this law, international transfers are permitted only when adequate safeguards are in place. We comply with National Cyber Security Authority (NCSA) requirements for cross-border data flows, including registration and documentation of all international data transfer arrangements, contractual mechanisms ensuring foreign processors meet Rwandan data protection standards, and risk assessments for each jurisdiction where data is transferred.

Standard Contractual Clauses (SCCs), also known as model clauses, are pre-approved legal templates created by data protection authorities that establish binding obligations on both data exporters and importers. We use SCCs approved by the European Commission and recognized by Rwanda's NCSA in contracts with all international service providers. These clauses require processors to implement appropriate technical and organizational security measures, respect data subject rights regardless of where processing occurs, cooperate with data protection authorities and investigations, notify us immediately of any data breaches or government data requests, and submit to audits and inspections to verify compliance.

For data transfers to the European Union, we leverage GDPR adequacy decisions. The EU Commission determines which countries have data protection laws "adequate" to European standards, allowing free data flow without additional safeguards. While Rwanda doesn't currently have an adequacy decision, EU member states do, so transfers to EU-based processors benefit from this framework. For UK data transfers, we comply with UK GDPR and the UK's adequacy determination process.

The EU-US Data Privacy Framework replaces the previous Privacy Shield program and provides a mechanism for transferring data between the EU and certified US companies. If we use US-based service providers, we verify their participation in this framework or implement alternative safeguards like SCCs. This framework includes strict requirements for data security, limitations on government access, and individual redress mechanisms for EU citizens.

Additional legal mechanisms we employ include binding corporate rules for multinational service providers that have internal privacy policies approved by data protection authorities, codes of conduct developed by industry associations and approved by regulators, certification schemes demonstrating compliance with international privacy standards (ISO 27701, Privacy Shield, etc.), and individual consent for specific transfers when you explicitly authorize international processing for particular purposes.

3. Cross-Border Processing Purposes and Necessity
We don't transfer your data internationally arbitrarily or for convenience alone. Each transfer serves specific, necessary purposes that enable the functionality and security you expect:

Payment Processing Through Licensed Gateways is perhaps the most critical international transfer. Our payment partner (XentriPay) operates infrastructure across multiple countries to provide reliable, secure financial services. When you make or receive a payment, transaction data is processed through international banking networks, payment card networks (Visa, Mastercard), and fraud detection systems that operate globally. These transfers are essential for secure, reliable payments and are protected by financial services regulations including PCI DSS compliance and banking confidentiality requirements.

Cloud Storage and Backup Systems leverage global infrastructure from reputable providers like Amazon Web Services (AWS), Microsoft Azure, or Google Cloud Platform. These providers operate data centers across multiple continents, offering redundancy and reliability that would be impossible with single-location storage. Your data may be stored in primary locations (like EU data centers) with replicated backups in secondary locations (like South African or Kenyan data centers) to ensure that even catastrophic events don't result in data loss. All storage uses encryption at rest and in transit.

Customer Support Services and Communication Tools may involve international transfers when we use cloud-based support platforms, email services, or chat systems hosted outside Rwanda. Support agents access information from our secure systems regardless of their physical location, enabling us to provide assistance across time zones and in multiple languages. All support personnel are bound by confidentiality obligations and access only information necessary for their support functions.

Analytics and Platform Improvement relies heavily on services like Google Analytics, which process usage data in Google's global infrastructure. These analytics help us understand how users interact with our platform, identify problems, and prioritize improvements. Analytics data is typically aggregated and anonymized, reducing privacy risks, and we configure analytics tools to respect privacy preferences including IP anonymization and opt-out signals.

Identity Verification and KYC Compliance may involve specialized verification services with expertise in document authentication and fraud detection. These services may process identity documents in secure facilities optimized for such processing, using advanced technologies like optical character recognition (OCR), biometric analysis, and database cross-referencing. The international nature of these services enables access to global watchlists, fraud databases, and verification resources that enhance security beyond what domestic-only services could provide.

AML/CTF Monitoring and Compliance requires screening transactions against international sanctions lists, terrorist financing watchlists, and politically exposed persons (PEP) databases. These checks inherently involve international data transfers because the lists are maintained by international bodies (UN, OFAC, EU, FATF) and because comprehensive screening requires accessing data from multiple jurisdictions. These transfers are legally required under Rwanda's Law No. 69/2018 on Prevention and Punishment of Money Laundering and Terrorism Financing.

4. EU and International User Rights
For users located in the European Economic Area (EEA), United Kingdom, or other jurisdictions with comprehensive data protection laws, you benefit from additional protections and rights:

GDPR Protection applies to all data subjects physically located in the EU when their data is processed, regardless of where the data controller is based. This means if you're in the EU using Amoria Connekyt, GDPR protections apply to you. These protections include all the rights described in the "Your Rights and Choices" section of this policy, including access, rectification, erasure, restriction, portability, and objection. Additionally, GDPR provides explicit protections for international data transfers through Article 44-50, requiring that transfers occur only when adequate safeguards exist.

We maintain EU representative contact information as required by GDPR Article 27. Our EU representative can be contacted for GDPR-specific inquiries, complaints to EU data protection authorities, and questions about how GDPR applies to your data. This representative acts as a point of contact between us, EU data subjects, and EU supervisory authorities, ensuring that geographic distance doesn't impede your rights.

You have additional rights under European law beyond those provided by Rwandan law, including the right to lodge complaints with your local supervisory authority (each EU member state has a data protection authority), the right to judicial remedy against data controllers and processors, specific protections regarding automated decision-making and profiling, additional restrictions on processing of special categories of data (health, biometric, etc.), and enhanced breach notification requirements (we must notify authorities within 72 hours and affected individuals without undue delay).

Data transfers from the EU follow GDPR Article 45 and 46 requirements strictly. Article 45 governs transfers based on adequacy decisions (where the destination country has data protection laws deemed adequate by the EU Commission). Article 46 governs transfers with appropriate safeguards such as Standard Contractual Clauses, Binding Corporate Rules, approved codes of conduct, or approved certification mechanisms. We ensure all our data transfers comply with these requirements, regularly review transfer mechanisms for legal validity (especially following court decisions like Schrems II), and implement supplementary measures where necessary to enhance protection.

5. Security During Transfer and Technical Safeguards
International data transfers introduce additional security considerations. Data traveling across networks and borders faces potential interception, unauthorized access during transit, and varying levels of legal protection in different jurisdictions. We implement comprehensive security measures to protect data throughout its international journey:

All data transfers use encrypted connections implementing SSL/TLS protocols with strong cipher suites. This means data is encrypted before transmission, travels through secured channels, and is decrypted only by authorized recipients with proper credentials. Encryption keys are managed securely and rotated regularly to maintain security. For particularly sensitive data (like payment information or identity documents), we may implement additional encryption layers beyond transport security.

We vet all international service providers rigorously before engaging them and continuously monitor their compliance. Our vendor due diligence process includes reviewing security certifications and compliance (ISO 27001, SOC 2 Type II, etc.), assessing data protection policies and practices, evaluating technical security controls, checking for history of breaches or security incidents, and verifying financial stability and operational reliability. Only providers meeting our strict criteria are approved for handling user data.

Regular compliance audits are conducted both internally and by external auditors. We maintain audit rights in all contracts with international processors, allowing us to verify their security controls, assess compliance with contractual obligations, investigate concerning incidents or reports, and ensure continuous adherence to our standards. Audits may include technical security assessments, policy and procedure reviews, and testing of incident response capabilities.

Only partners meeting equivalent privacy standards are used. We don't compromise on data protection even when transferring to jurisdictions with potentially weaker laws. Contractual obligations require processors to meet or exceed Rwanda's data protection standards regardless of their local laws, implement security measures consistent with international best practices, notify us of any conflicts between local law and data protection obligations, and allow us to terminate contracts if protection standards can't be maintained.

Continuous monitoring of data transfer security includes tracking where data flows in real-time, monitoring for unauthorized access or anomalous patterns, reviewing logs of cross-border data movements, assessing ongoing compliance with transfer mechanisms, and staying informed about legal or regulatory changes affecting transfers. If we identify risks or compliance issues, we take immediate corrective action including enhancing security measures, renegotiating contracts, moving data to different jurisdictions, or suspending transfers until risks are mitigated.

6. National Cyber Security Authority (NCSA) Compliance
Rwanda's National Cyber Security Authority (NCSA) plays a central role in overseeing international data transfers and ensuring that cross-border data flows don't compromise Rwandan citizens' privacy:

We maintain comprehensive documentation of all international data flows as required by NCSA regulations. This documentation includes detailed mappings of what data is transferred, where it's transferred (specific countries and service providers), why transfers are necessary (business purposes), what legal mechanisms protect transfers (SCCs, contractual clauses, etc.), and what security measures safeguard data. This documentation is regularly updated and available for NCSA review during audits or investigations.

We register cross-border data transfers with NCSA where required, providing transparency about our international data practices. Registration includes information about the nature and volume of transfers, the countries involved, the purposes of processing, and the safeguards implemented. This registration enables NCSA to oversee international data flows and intervene if inadequate protections are identified.

We cooperate fully with NCSA inquiries, investigations, and audits related to international data transfers. If NCSA identifies concerns about specific transfers or jurisdictions, we work collaboratively to address issues, implement additional safeguards, or modify our data flows to ensure compliance. We respect NCSA's authority to restrict or prohibit international transfers that don't meet Rwanda's data protection standards.

7. Your Consent and Control
By using Amoria Connekyt, you consent to international data transfers as described in this policy, subject to all the protections and safeguards outlined above. This consent is informed. You now understand where your data may go, why it's transferred, and how it's protected. Your consent is specific. It covers only the transfers and purposes described in this policy, not unlimited international processing. And your consent is revocable. You can withdraw it by closing your account, though this means you'll no longer be able to use our services.

You maintain control over your data even when it crosses borders. Your rights to access, rectify, delete, restrict, port, and object to processing apply regardless of where your data is physically located or processed. If you have concerns about international transfers, you can exercise your rights to object to processing or request data deletion. We'll honor these requests subject to legal retention requirements.

If laws or circumstances change in ways that compromise the adequacy of protections for international transfers, we'll take prompt action to protect your data. This might include moving data to different jurisdictions with stronger protections, implementing additional security measures or contractual safeguards, suspending transfers that can't be adequately protected, or notifying you of changes and providing opt-out options.

Our Commitment to Cross-Border Privacy: International data transfers are essential for providing modern, reliable, global services. However, we recognize that borders shouldn't be excuses for compromising privacy. We're committed to ensuring that your data receives consistent, high-level protection regardless of where it's processed, that legal safeguards travel with your data across borders, and that you maintain full rights and control over your information everywhere.`
    },
    {
  id: 'rwanda-privacy',
  title: 'Rwanda Data Protection and Privacy Rights',
  content: `Rwanda has established itself as a leader in data protection across Africa with the enactment of the Data Protection and Privacy Law No. 058/2021 of 13/10/2021. This comprehensive legislation reflects Rwanda's commitment to protecting personal information in the digital age while fostering innovation, economic growth, and trust in technology. As a Rwandan-based platform, Amoria Connekyt proudly operates under this framework, respecting and upholding the strong privacy rights it guarantees to all data subjects (individuals whose personal information we collect, process, or store).

This law isn't merely a set of abstract requirements for businesses to navigate. It represents a fundamental recognition that personal data belongs to individuals, not to the organizations that process it. Your information is yours, and Rwanda's law ensures you maintain meaningful control over it. Below is a comprehensive explanation of your rights under this law and how Amoria Connekyt honors them in practice.

Understanding the Law's Foundation:
Rwanda's Data Protection and Privacy Law establishes several core principles that govern all data processing activities. These principles require that personal data be processed lawfully, fairly, and transparently. You have the right to understand what's happening with your information. Data must be collected for specified, explicit, and legitimate purposes and not further processed in ways incompatible with those purposes. We practice data minimization, collecting only what's adequate, relevant, and limited to what's necessary for our purposes. Accuracy is paramount. We must keep personal data accurate and up-to-date. Storage limitation means we retain data only as long as necessary for legitimate purposes. And integrity and confidentiality require us to process data securely, protecting against unauthorized or unlawful processing and against accidental loss, destruction, or damage.

These principles aren't just aspirational. They're enforceable legal requirements that underpin all our data handling practices.

1. Right to Be Informed (Transparency Principle)
Transparency is the foundation upon which all other rights rest. If you don't know what's happening with your data, you can't exercise meaningful control over it. That's why Rwanda's law grants you an explicit right to be informed about data processing activities involving your personal information.

This right to be informed means you must know who is collecting your data (Amoria Global Tech Ltd., the entity behind Amoria Connekyt), what specific types of personal data are being collected (as detailed in our "Information We Collect" section), why your data is being collected and processed (the purposes, as explained in "How We Use Your Information"), the legal basis that justifies the processing (consent, contractual necessity, legal obligation, or legitimate interest), who will have access to your data and under what circumstances (as described in "Data Sharing and Disclosure"), how long your data will be retained (detailed in our "Data Retention" section), what rights you have regarding your data, and how to exercise those rights.

This Privacy Policy fulfills our obligation to inform you about these matters. We don't hide information in complex legal language or bury important details in footnotes. We present it clearly, comprehensively, and accessibly. When we collect new types of data or begin processing for new purposes, we'll inform you and, where required, seek your consent before proceeding.

Transparency also extends to your right to know when data breaches occur. If your personal data is compromised in a security incident, we'll notify you within 72 hours as required by law, explaining what happened, what data was affected, what we're doing about it, and what steps you should take to protect yourself.

2. Right of Access (Right to Know What We Hold)
The right of access empowers you to obtain confirmation of whether we're processing your personal data and, if so, to access that data along with detailed information about the processing. This isn't a theoretical right. It's a practical tool for accountability that ensures we're handling your information appropriately.

You may request access to all personal data we hold about you, and we'll provide a comprehensive data package including your profile information (name, email, phone, biography, settings), account activity and history (bookings made or received, searches performed, pages viewed), communications and messages (conversations with other users, support interactions), transaction records (payments made or received, invoices, receipts), documents you've uploaded (identification documents, portfolio images, videos), reviews and ratings (both given and received), and technical data (IP addresses, device information, access logs).

Beyond just receiving a copy of your data, you have the right to know how it has been processed. We'll explain the purposes of processing (why we collected and used each type of data), the categories of data concerned (what types of information are involved), the recipients or categories of recipients to whom data has been disclosed (payment processors, cloud providers, regulatory authorities), the retention periods or criteria used to determine retention, your rights regarding the data (including rectification, erasure, restriction, objection), your right to lodge complaints with the National Cyber Security Authority (NCSA), the source of the data if we didn't collect it directly from you, and whether automated decision-making or profiling is occurring.

Exercising your access right is straightforward. Contact us at privacy@amoriaglobal.com with your request, including your full name, registered email address, and specific information you're seeking (or request everything if you prefer comprehensive access). We'll verify your identity (typically by confirming email address and account details) to ensure we're providing data to the right person. We'll respond within 30 days as required by Rwandan law, providing your data in a portable format such as JSON for structured data, PDF for documents and human-readable reports, or CSV for tabular data like transaction histories.

The first access request is free of charge. If you make manifestly unfounded or excessive requests, particularly repetitive requests within a short timeframe, we may charge a reasonable administrative fee or decline the request. However, we'll explain our reasoning if we can't fully comply with any request.

3. Right to Rectification (Right to Correct Inaccuracies)
Inaccurate or incomplete personal data can cause significant problems, from simple inconveniences to serious issues affecting your ability to use our services. The right to rectification ensures you can correct these problems promptly.

You have the right to request correction of any inaccurate personal data we hold about you without undue delay. Accuracy isn't just about whether information was correct when collected. It encompasses whether it remains accurate and current over time. If your phone number changes, your address updates, your professional biography evolves, or any other details become outdated, you have the right to have them corrected.

You also have the right to have incomplete personal data completed. For example, if your profile is missing important information that would help clients find you or understand your services, you can request that we complete it. This might involve providing additional statements or supplementary information that fills gaps in your profile.

For most data, you don't need to contact us. You can update your information directly through your account settings. The platform provides user-friendly interfaces for editing your profile details (name, email, phone, biography), portfolio content (images, videos, descriptions), service offerings and specialties, preferences and settings, and payment information. Changes take effect immediately, ensuring your profile is always current.

For data you cannot edit directly (such as KYC verification documents where changes require re-verification, historical transaction records where accuracy affects financial reporting, or system-generated data like timestamps or automated classifications), you can request correction by contacting support@connekyt.com. Include what data you believe is inaccurate, what the correct information should be, and any supporting evidence (especially for identity or financial data). We'll review your request, verify the correct information if necessary, update our records accordingly, and notify you when corrections are complete.

If we've disclosed the inaccurate data to third parties, we'll inform them of the rectification where possible and appropriate, ensuring that corrected information propagates through the ecosystem.

4. Right to Erasure ("Right to Be Forgotten")
The right to erasure, commonly known as the "right to be forgotten," recognizes that there are circumstances when personal data should no longer be retained. This powerful right allows you to request deletion of your personal data, freeing you from the perpetual digital trail that could otherwise follow you indefinitely.

You may request deletion of your personal data when any of the following circumstances apply: the data is no longer necessary for the purposes for which it was collected (for example, you've closed your account and completed all transactions, so continued retention serves no purpose); you withdraw consent for processing that was based on consent, and there's no other legal basis that justifies continued processing; the personal data has been unlawfully processed or collected without proper authorization or in violation of law; erasure is required to comply with Rwandan law or another legal obligation to which we're subject; or you successfully object to processing under your right to object, and there are no overriding legitimate grounds for us to continue processing.

However, the right to erasure is not absolute. We may decline or limit deletion requests when retention is required by law. For example, financial transaction records must be retained for 7 years under Rwandan tax law, and KYC documents must be kept for 5 years under AML/CTF regulations. Retention may also be necessary to complete transactions you initiated before requesting deletion, such as ongoing bookings or pending payments that must be properly finalized. We might need to retain data to establish, exercise, or defend legal claims, such as if there's an ongoing dispute that requires evidence from your communications or transaction records. Data might be needed to detect, prevent, or investigate fraud and security threats. For example, information about users who violated our policies may be retained to prevent them from creating new accounts and repeating violations.

When you request deletion, we'll carefully review the request against these criteria, identify what data can be deleted immediately and what must be retained, explain specifically what data must be retained, why retention is necessary, the legal basis requiring retention, and how long it will be retained, delete all eligible data from production databases, backup systems, log files, cached data, and any other locations where it exists, confirm deletion with you, providing detailed information about what was deleted and what remains, and document the request for compliance purposes.

Deletion is permanent and irreversible. Once data is deleted, it cannot be recovered. Before requesting deletion, consider whether you might need account history, transaction records, portfolio content, or other information in the future. You may want to export your data first using your right to data portability.

5. Right to Restrict Processing (Limiting How Data Is Used)
Sometimes you don't want your data deleted entirely, but you do want to limit how it's used. The right to restrict processing provides a middle ground, allowing you to "pause" certain processing activities while preserving the data itself.

You may request that we limit the processing of your personal data in specific circumstances: when you contest the accuracy of personal data and want processing suspended while we verify accuracy (for example, if you believe transaction records contain errors, you can request restriction while we investigate); when processing is unlawful but you prefer restriction over deletion, perhaps because you need the data for legal claims but don't want us using it for other purposes; when we no longer need the data for our purposes, but you require it for the establishment, exercise, or defense of legal claims (restriction preserves it for you while preventing us from using it); or when you've objected to processing based on legitimate interests pending our verification of whether our legitimate grounds override your objection.

When processing is restricted, we can still store the data (restriction doesn't require deletion) but we cannot perform other processing activities without your consent, except for purposes you approve, to establish or defend legal claims, to protect another person's rights, or for important public interests. Essentially, the data is "frozen" in our systems, accessible if needed for specific legitimate purposes but not used for routine operations, marketing, analysis, or other processing.

You'll be notified before any restriction is lifted, giving you the opportunity to object or take further action if needed. Restriction might be lifted when the circumstances that justified it no longer apply. For example, when accuracy is verified, when your legal claims are resolved, or when our assessment of legitimate grounds is completed.

To request restriction of processing, contact privacy@amoriaglobal.com specifying what data you want restricted, why you're requesting restriction (citing one of the legal grounds above), how long you anticipate the restriction should last if it's time-limited, and whether you consent to any specific uses during the restriction period. We'll implement the restriction within 30 days and confirm it with you.

6. Right to Data Portability (Freedom to Move Your Data)
Data portability is a powerful right that prevents vendor lock-in and promotes competition by allowing you to move your data between service providers. This right recognizes that your data is yours, not ours, and you should be free to take it elsewhere.

You have the right to receive your personal data in a structured, commonly used, and machine-readable format. This means data formatted for easy processing by computers and compatible with common software and platforms. You can receive this data yourself for backup, analysis, or transfer to another service, or where technically feasible, you can request that we transmit it directly to another controller (another platform or service provider).

Data portability applies to personal data you've provided to us directly (information you entered into forms, content you uploaded, communications you sent) and to data generated through your use of our services such as transaction history, booking records, usage analytics, and reviews. It doesn't typically include derived or inferred data we've created, like internal risk scores or proprietary analytics.

We provide portable data in formats appropriate to the data type: JSON (JavaScript Object Notation) for structured data like profiles and settings, offering flexibility and compatibility with many programming languages and tools; CSV (Comma-Separated Values) for tabular data like transaction histories, easily imported into spreadsheets or databases; or PDF for documents and human-readable reports, suitable for viewing and printing but less structured for programmatic processing.

To exercise your portability right, contact privacy@amoriaglobal.com specifying what data you want to receive (or request a complete export), your preferred format (JSON, CSV, PDF, or let us choose based on data type), and whether you want data sent to you or transmitted to another controller (if the latter, provide details about the recipient). We'll prepare your portable data package, verify your identity, and deliver it within 30 days.

Data portability empowers you to compare services without friction, migrate to competitors if you find better alternatives, backup your own data for personal records, use third-party tools to analyze your information, and maintain genuine control over your digital life. We support portability not just because it's legally required, but because we believe users should have true freedom and control.

7. Right to Object (Challenging Unwanted Processing)
The right to object allows you to challenge processing activities that you find problematic, even if we have a legal basis for them. This right acknowledges that legal processing isn't always appropriate for every individual in every situation.

You have an absolute right to object to processing for direct marketing purposes at any time, and we must stop immediately. This includes marketing emails, promotional messages, targeted advertisements, and profiling for marketing purposes. No justification is needed. Simply stating your objection is sufficient, and we must comply without delay.

You can also object to processing based on our legitimate interests if you can demonstrate compelling reasons related to your particular situation that make the processing inappropriate. When you object on these grounds, we must stop processing unless we can demonstrate compelling legitimate grounds that override your interests, rights, and freedoms, or we need the data for legal claims. For example, if we use your data for fraud prevention (a legitimate interest), you might object by showing that this processing unfairly impacts you in your specific circumstances.

You can specifically object to profiling and automated decision-making that significantly affects you, requesting human review and intervention; data sharing with partners for non-essential purposes beyond what's strictly necessary for delivering the services you requested; analysis of your behavior or activities for purposes beyond basic service improvement; or other uses that you find objectionable given your particular circumstances.

To object to processing, contact privacy@amoriaglobal.com or adjust your marketing preferences in account settings for marketing objections. Specify what processing you're objecting to clearly, explain why you object (especially if claiming your particular situation makes processing inappropriate), and indicate whether you're objecting to all such processing or only specific uses. For marketing, we'll stop immediately. For other processing based on legitimate interests, we'll evaluate within 30 days whether we can continue processing, inform you of our decision with reasoning, and stop processing if we cannot demonstrate overriding legitimate grounds.

8. Rights in Automated Decision-Making and Profiling
Automated decision-making, where computers make significant decisions about you without human involvement, offers efficiency but can also lead to unfair outcomes if not properly controlled. Rwanda's law provides you with specific rights regarding such automated processing.

You have the right not to be subject to decisions based solely on automated processing, including profiling, that produces legal effects concerning you or similarly significantly affects you. This means that significant decisions affecting your rights, access to services, or opportunities should involve human judgment, not just algorithms.

At Amoria Connekyt, we use limited automated systems for functions like matching clients with photographers based on criteria like location, specialty, and availability (not a significant decision affecting rights, just search results you can choose to act on or ignore); detecting potentially fraudulent transactions through pattern analysis (significant, but always involves human review before taking action); recommending photographers or services based on your preferences and browsing history; and analyzing usage patterns for platform improvements (aggregated, not individually impactful).

We commit to ensuring that significant decisions (like account suspensions, payment holds, identity verification failures, or dispute resolutions) always involve meaningful human review. If an automated system flags your account or transaction, a human reviews the context, considers factors the algorithm might miss, and makes the final decision.

You have the right to obtain human intervention in automated decisions, express your point of view and provide context the automated system didn't consider, and receive an explanation of the decision including the logic involved, the significance and consequences of the processing, what factors influenced the decision, and how you can challenge it if you believe it's incorrect.

If an automated system makes an adverse decision affecting you, contact support@connekyt.com immediately. Explain the situation, provide relevant context, and request human review. We'll have a qualified person review the decision with fresh eyes, consider your explanation and any additional information, and make a final determination that may overturn or modify the automated decision.

9. Data Protection and Security
Beyond specific rights to control your data, you have a fundamental right to security: the assurance that your personal information is protected against unauthorized access, unlawful processing, and accidental loss or destruction.

Amoria Connekyt implements comprehensive technical and organizational measures to secure your data as detailed extensively in our "Data Storage and Security" section. These measures include encryption using SSL/TLS for data in transit and AES-256 for data at rest, ensuring that even if data is intercepted or accessed without authorization, it cannot be read without encryption keys; access control mechanisms implementing role-based access, multi-factor authentication for administrative access, and principle of least privilege ensuring employees access only data necessary for their functions; secure storage in certified data centers with physical security, environmental controls, redundancy, and disaster recovery capabilities; regular audits and compliance checks conducted by internal teams and independent third-party security firms to identify vulnerabilities before they can be exploited; security monitoring using 24/7 Security Operations Center (SOC), intrusion detection and prevention systems, and automated threat detection; incident response protocols clearly defining how we respond to security events, including containment, investigation, notification, and remediation; and employee training ensuring all personnel understand security responsibilities and data protection obligations.

These aren't just checkboxes we mark for compliance. They're fundamental commitments we make to earning and maintaining your trust. Security is built into our development processes, operational procedures, and corporate culture.

10. Cross-Border Data Transfers
While international data transfers are covered extensively in the dedicated "International Data Transfers" section, it's worth emphasizing here that Rwanda's law provides specific protections when your data leaves the country.

We transfer personal data outside Rwanda only when adequate protection measures are in place. This means the destination country has data protection laws recognized as adequate by Rwanda's NCSA, we've implemented Standard Contractual Clauses (SCCs) or other approved transfer mechanisms, we've conducted transfer impact assessments ensuring your rights remain protected, and we maintain documentation of all cross-border transfers available for NCSA review.

You have the right to be informed about international transfers, object to transfers you believe are inadequately protected, and exercise all your other rights (access, rectification, erasure, etc.) even for data processed outside Rwanda. Your rights don't stop at the border. We ensure they travel with your data wherever it goes.

11. Data Retention
Data retention is governed by principles of purpose limitation and storage limitation. We retain data only as long as necessary to fulfill legitimate purposes or comply with legal obligations. Specific retention periods are detailed in our comprehensive "Data Retention" section.

Under Rwanda's law, you have the right to know how long we retain different types of data, understand the criteria we use to determine retention periods, and request deletion once retention is no longer justified. We don't retain data indefinitely "just in case". We have specific, documented retention schedules based on business necessity and legal requirements.

When retention periods expire, we actively and securely delete data rather than simply ignoring it. Deletion is permanent, using secure methods that prevent recovery. You can request information about retention periods for your specific data at any time.

12. How to Exercise Your Rights
Exercising your rights under Rwanda's Data Protection and Privacy Law should be straightforward and accessible. We've designed simple, user-friendly processes for all rights requests.

To exercise any of these rights, contact us at privacy@amoriaglobal.com with the subject line "Rwanda Data Privacy Request" to ensure proper routing. Include your full name as registered in your account, the email address associated with your account, your account username or ID if known, the specific right you wish to exercise (access, rectification, erasure, restriction, portability, objection), a clear description of your request, and any supporting information relevant to your request (especially for rectification or objection requests).

We will respond within 30 days as required by Rwandan law. Complex requests involving large amounts of data or requiring detailed investigation may take up to 60 days, but we'll inform you within the first 30 days if we need the extension and explain why. We'll verify your identity before responding to protect your data from unauthorized access. Verification typically involves confirming email address control and account details, though we may request additional verification for particularly sensitive requests.

Our response will include confirmation of actions taken (what we did in response to your request), explanation of any limitations or denials with specific legal justification citing relevant provisions of Rwanda's Data Protection and Privacy Law, information about data retained and deletion timelines if you requested erasure, guidance on next steps if applicable, and contact information for follow-up questions or concerns.

Most rights requests are free of charge. We may charge a reasonable administrative fee for manifestly unfounded or excessive requests, particularly repeated requests for the same data within a short timeframe, but we'll explain our reasoning if we believe a fee is justified.

13. Supervisory Authority and Filing Complaints
If you believe your data protection rights under Rwanda's Data Protection and Privacy Law have been violated, or if you're dissatisfied with how we've handled your rights request, you have the right to file a complaint with the supervisory authority.

In Rwanda, the supervisory authority for data protection matters is the National Cyber Security Authority (NCSA), which operates a dedicated Data Protection Office responsible for enforcing the law, investigating complaints, ordering corrective actions, and imposing penalties for violations.

You can contact the NCSA Data Protection Office in Kigali, Rwanda. Their website is www.ncsa.gov.rw, where you'll find complaint forms, contact details, guidance on the complaint process, information about your rights, and updates on data protection enforcement. The NCSA is an independent authority with significant powers to investigate complaints, inspect data controllers and processors, order corrective measures including data deletion or processing restrictions, impose administrative fines for violations, and provide binding decisions on data protection matters.

When filing a complaint with NCSA, provide detailed information including your full name and contact information, description of the alleged violation (what happened, when, and how your rights were affected), documentation of your attempts to resolve the issue with us directly (copies of correspondence, our responses, etc.), explanation of how your rights under the Data Protection and Privacy Law were violated (cite specific articles if possible), and your desired outcome or remedy (what you want the NCSA to order us to do).

The NCSA will acknowledge your complaint, potentially request additional information from you, investigate by reviewing evidence and potentially contacting us for our response, and make a determination which may include finding no violation, ordering us to take corrective action, imposing fines if violations are confirmed, or providing guidance on how to resolve the dispute.

We encourage you to contact us directly first before escalating to the NCSA, as we're committed to resolving issues cooperatively and transparently. Many concerns can be addressed quickly through direct communication. However, contacting us first is not a legal requirement. You have the absolute right to file a complaint with the NCSA at any time, without first attempting to resolve the matter with us.

Our Commitment to Rwanda's Data Protection Vision:
Rwanda's Data Protection and Privacy Law represents a vision of responsible, respectful data processing that protects individuals while enabling innovation and economic development. At Amoria Connekyt, we share this vision and are proud to be part of Rwanda's digital transformation. We don't view data protection as a burden or obstacle. We see it as a competitive advantage and a foundation for trust. By rigorously honoring your rights, protecting your information, and operating transparently, we aim to build a platform where users feel safe, respected, and empowered.`
},

    {
      id: 'policy-updates',
      title: 'Updates to This Policy',
      content: `Privacy policies aren't static documents. They evolve as our services change, new technologies emerge, legal requirements update, and user expectations develop. This Privacy Policy may be updated from time to time to reflect changes in our data practices, comply with new regulations, or address user feedback. However, we don't take changes lightly. Every update is carefully considered, transparently communicated, and designed to maintain or enhance your privacy protections.

Understanding why and how we update our policy helps you stay informed about your privacy rights and data protection practices. Below is a comprehensive explanation of our policy update process, your rights regarding changes, and how we ensure transparency throughout.

1. Notification of Changes and Communication
When we make changes to this Privacy Policy, we're committed to notifying you clearly and giving you adequate time to review updates before they take effect. The nature and extent of notification depends on the significance of the changes:

For significant changes that materially affect your privacy rights, how we collect or use data, or what information we share with third parties, we implement comprehensive notification procedures. We will update the "Last Updated" date at the top of this policy, making it immediately visible when you visit. We'll send individual email notifications to all registered users at their registered email addresses, with clear subject lines like "Important Privacy Policy Update" or "Changes to Amoria Connekyt Privacy Practices." These emails won't be generic announcements. They'll specifically explain what's changing, why the changes are being made, how the changes affect you, what options or choices you have, and when the changes will take effect.

We'll also display prominent notices on the platform itself, including banner notifications on the homepage and dashboard that persist until you acknowledge them, pop-up notices when you log in explaining the key changes and providing a link to review the full updated policy, and in-app notifications through our notification system ensuring mobile users are informed. Major changes affecting fundamental privacy rights will be accompanied by a 30-day notice period before taking effect. This grace period gives you time to review the changes carefully, ask questions or raise concerns, exercise your rights (such as requesting data deletion or objecting to new processing), or discontinue using the service if you disagree with the changes.

During this notice period, the existing policy remains in effect, so your rights and protections don't change until you've had adequate time to respond. If you have concerns about proposed changes, we encourage you to contact us during this period. User feedback may influence how we implement changes or whether we proceed with them at all.

2. Minor and Administrative Changes
Not all policy updates are equally significant. Some changes are minor, technical, or administrative in nature and don't materially affect your privacy rights or data practices. For these types of updates, we follow a simplified notification process while maintaining transparency:

Minor changes might include correcting typographical errors, broken links, or formatting issues that don't affect meaning; updating contact information such as email addresses, phone numbers, or physical addresses; clarifying existing language to make it clearer without changing the substance of our practices; reorganizing sections or adding examples to improve readability and understanding; updating references to laws or regulations where the substance hasn't changed but citation formats have; or adding information about features or services that operate under the same privacy principles already described.

For these minor changes, we will update the policy with a revised "Last Updated" date clearly displayed at the top, and we may highlight or annotate changes within the policy text itself (for example, using change markers or revision notes for a period after the update). Continued use of Amoria Connekyt after minor updates constitutes acceptance of the revised terms. However, we still maintain transparency. If you regularly review the policy (which we encourage), you'll notice the updated date and can review what changed.

Even for minor updates, you can always contact us at privacy@amoriaglobal.com if you have questions about what changed or how it might affect you. We'll provide detailed explanations of any updates, regardless of how minor they might seem to us.

3. Review Frequency and Triggers for Updates
We don't wait for problems to arise before reviewing our privacy practices. We proactively and regularly assess this policy and our data handling procedures to ensure they remain appropriate, compliant, and aligned with user expectations. Our review and update process is triggered by several factors:

Annual compliance audits are conducted as part of our regular governance and risk management processes. At least once per year, typically in advance of our fiscal year-end, we conduct comprehensive reviews of this policy, our actual data practices (comparing what we say we do with what we actually do), applicable legal requirements and recent regulatory changes, industry best practices and evolving privacy standards, and user feedback and privacy-related support inquiries. These annual reviews ensure that our policy remains accurate, complete, and reflective of current practices, even if no specific changes are immediately necessary.

When launching new features or services that involve data collection or processing, we review this policy before launch to determine whether updates are necessary. For example, if we introduce a new payment method, video streaming feature, AI-powered recommendation system, or integration with a new third-party service, we assess whether the feature involves new types of data collection, new processing purposes, new third-party relationships, or new potential privacy impacts. If the new feature operates under existing policy provisions, no update may be needed. However, if it introduces genuinely new data practices, we update the policy accordingly and notify users before the feature launches.

When legal requirements change, whether through new legislation, regulatory guidance, court decisions, or enforcement actions, we promptly assess the impact on our policy and practices. Examples include new data protection laws in jurisdictions where we operate or where users are located, regulatory guidance from Rwanda's NCSA or other data protection authorities, court decisions affecting privacy rights or data transfer mechanisms, or international developments like GDPR updates or changes to adequacy decisions. Compliance with applicable law is non-negotiable, so legal changes may trigger immediate policy updates if necessary to maintain compliance.

User feedback and privacy concerns provide valuable insights that can drive policy improvements. If we receive questions indicating that policy language is unclear or confusing, complaints suggesting that our practices don't match user expectations, requests for features or controls that aren't adequately addressed in our policy, or reports of privacy issues or concerns, we take this feedback seriously and may update our policy to address gaps, clarify confusing sections, or better align practices with user expectations.

Industry developments and emerging best practices in privacy and data protection also inform our reviews. We monitor privacy research and publications, industry standards and frameworks (like ISO 27701 updates), best practices from privacy professionals and advocacy organizations, and technological developments affecting privacy (like new encryption methods or anonymization techniques). If we identify opportunities to enhance privacy protections or adopt emerging best practices, we may update our policy and practices proactively, even in the absence of legal requirements.

4. Version History and Transparency
Transparency about policy changes over time is important for accountability and trust. Users should be able to understand how our privacy practices have evolved and compare current policies with previous versions to identify specific changes.

We maintain comprehensive version history of this Privacy Policy, documenting each version with its effective date, a summary of changes made in that version, and reasons for the changes. Previous versions of this policy are available upon request for comparison and transparency purposes. If you want to review how our policy has changed over time, contact privacy@amoriaglobal.com and request access to prior versions. We'll provide previous versions along with change summaries highlighting what was modified between versions.

This version history serves multiple purposes: it provides accountability by creating a permanent record of our privacy commitments at each point in time; it enables comparison so users can see exactly what changed between versions; it supports compliance by demonstrating to regulators that we've maintained appropriate privacy protections over time; and it builds trust by showing that we don't hide past commitments or silently change practices without notice.

5. Your Responsibility and Active Engagement
While we commit to notifying you of policy updates, you also have responsibilities in staying informed about privacy practices. Privacy is a partnership between us and you. We provide the tools, protections, and transparency, but you need to engage actively with the information we provide.

We encourage you to review this policy periodically, even in the absence of specific change notifications. Best practice is to review privacy policies annually or whenever you're making decisions about what personal information to provide or how to use privacy-sensitive features. Check the "Last Updated" date at the top of this policy whenever you visit. If it's changed since you last reviewed the policy, take time to read through the updates. Look for highlighted changes or revision notes we may include to make it easier to identify what's new.

If you have questions about changes, don't hesitate to contact us at privacy@amoriaglobal.com. Questions might include: "Why was this specific change made?" "How does this change affect my existing data?" "What new options or controls do I have?" or "Can you explain this new section in simpler terms?" We're happy to provide detailed explanations and help you understand how changes might impact you specifically.

If you disagree with changes, you have rights and options. You can exercise your privacy rights, such as objecting to new processing purposes, restricting certain data uses, or requesting data deletion. You can adjust your account settings to limit data collection or sharing where options are available. You can provide feedback explaining your concerns. User input may influence how we implement changes. Or, if fundamental changes are incompatible with your privacy preferences, you can discontinue using the service and request account deletion under your right to erasure.

Your active engagement ensures that you maintain control over your personal information and that privacy protections work as intended. We provide the framework and tools, but you ultimately decide how much information to share and how to exercise your rights.

6. Continued Use and Implicit Acceptance
For minor and non-material changes, continued use of Amoria Connekyt after policy updates indicates acceptance of the revised terms. This is a standard practice across online services and is necessary for practical reasons. Requiring explicit consent for every minor update would be burdensome for users and impractical for us.

However, implicit acceptance through continued use only applies to updates that don't materially affect your rights or fundamentally change our data practices. Material changes are handled differently (see section 7 below). When you continue using our platform after updates take effect, you're indicating that you've had the opportunity to review changes (whether or not you actually did), you understand that continued use constitutes acceptance, and you accept the updated terms going forward.

If you do not agree with updated terms, you should discontinue use of Amoria Connekyt before the changes take effect. We don't want users to feel trapped by policy changes they find unacceptable. You can close your account at any time and may request account deletion and data erasure under your rights. We'll honor deletion requests subject to legal retention requirements, providing you with a clean exit if you disagree with how our privacy practices evolve.

Before discontinuing use due to policy changes, we encourage you to contact us with your concerns. In many cases, there may be misunderstandings we can clarify, alternatives we can offer, or settings you can adjust to address your specific concerns without needing to leave the platform entirely.

7. Material Changes and Explicit Consent
Not all policy changes can be accepted through continued use alone. Some changes are so significant that they require explicit, informed consent before taking effect. These "material changes" fundamentally alter the relationship between you and us regarding your personal data.

Material changes requiring explicit consent or opt-in include introducing entirely new purposes for data processing that weren't previously disclosed (for example, if we decided to use your data for marketing purposes when we previously didn't); significantly expanding the categories of third parties with whom we share data (such as beginning to share data with advertisers or data brokers when we previously didn't); reducing privacy protections or rights you previously enjoyed (though we strive to avoid this); implementing new technologies that significantly change how we process data; or fundamentally changing our business model in ways that affect data use (such as transitioning to an advertising-based revenue model).

When material changes are proposed, we will notify you clearly and prominently as described in section 1 above, provide a detailed explanation of what's changing and why, clearly state that explicit consent is required, present an explicit choice mechanism. You'll need to actively consent (opt-in) rather than having consent implied by continued use, and allow you to decline the changes and continue using the platform under existing terms where feasible, or to close your account and request data deletion if the changes are not acceptable to you.

We'll provide a reasonable timeframe (typically 30 to 60 days) for you to make your decision. During this period, the existing policy remains in effect for your account until you provide explicit consent to the new terms. If you don't provide consent by the deadline, we may need to limit or suspend certain features affected by the changes, or in some cases, close your account if the changes are necessary for us to operate legally or securely.

Our goal is never to force material changes on users who don't consent. Wher ever possible, we'll offer alternatives such as opting out of specific new features while maintaining access to core services, providing granular consent options for different types of processing, or allowing you to export your data and gracefully exit if you prefer not to accept material changes.

8. Legal and Regulatory Updates
Sometimes policy updates are driven entirely by changes in legal or regulatory requirements beyond our control. When laws change, we must update our practices and policy to remain compliant, even if we would have preferred to maintain existing practices.

Legal and regulatory updates might include new data protection laws in Rwanda or other jurisdictions requiring new disclosures, rights, or protections; regulatory guidance from Rwanda's NCSA or other data protection authorities clarifying how laws should be interpreted or implemented; court decisions affecting privacy rights, data transfer mechanisms, or consent requirements; or international regulatory developments like GDPR amendments, adequacy decision changes, or new transfer mechanisms.

When updates are legally mandated, we'll clearly explain that the changes are required by law, cite the specific legal provisions or regulatory guidance driving the change, explain how the legal requirement affects you and your rights, and provide any new controls or options that the law requires us to offer. While we may not be able to avoid implementing legally required changes, we'll still notify you transparently and help you understand your rights under the new legal framework.

9. User Input and Participation
While we ultimately control this policy's content, we value user input and encourage participation in shaping our privacy practices. If you have suggestions for policy improvements, concerns about specific practices, or questions about unclear sections, please share them with us at privacy@amoriaglobal.com.

User feedback has genuinely influenced our privacy practices in the past and will continue to do so. We're more likely to adopt user-friendly practices and clearer language when users take the time to provide constructive feedback. Your voice matters in shaping how we protect privacy.

Our Commitment to Responsible Updates:
We commit to updating this policy only when necessary, to communicating changes transparently and clearly, to providing adequate notice and choice for material changes, to maintaining or enhancing privacy protections with each update, and to respecting your rights and preferences throughout the update process. Privacy policies should be living documents that evolve responsibly, not weapons for silently eroding user rights. We're committed to the former approach.`
    },
    {
      id: 'contact-us',
      title: 'Contact Information',
      content: `Open communication is essential for maintaining trust and ensuring that your privacy rights are respected. We're committed to being accessible, responsive, and helpful when you have questions, concerns, or requests related to your privacy and personal data. Whether you need to exercise your rights, report a concern, ask questions about our practices, or simply want to understand something better, we're here to help.

Below you'll find comprehensive contact information for different types of inquiries, along with guidance on what to expect when you reach out to us, how we handle different types of requests, and our commitments regarding response times and quality.

Primary Contact Information

Amoria Global Tech Ltd. (Rwanda)
We are a Rwandan-registered company operating under Rwanda's Data Protection and Privacy Law No. 058/2021 and other applicable laws. Our legal entity name is Amoria Global Tech Ltd., and we're the data controller responsible for the personal information processed through the Amoria Connekyt platform.

General Inquiries
For general questions about our platform, services, or business:
• Email: info@amoriaglobal.com
• Website: www.connekyt.com
• Use this contact for: Platform features and functionality questions, business partnership inquiries, media and press inquiries, general information requests, account setup assistance, and non-urgent questions about our services.
• Expected response time: Within 48-72 hours for general inquiries, prioritized based on urgency and complexity.

Privacy and Data Protection Requests
For all matters specifically related to privacy, data protection, and exercising your rights:
• Email: privacy@amoriaglobal.com
• Use this contact for: Exercising your data subject rights (access, rectification, erasure, restriction, portability, objection), questions about how we collect, use, or share your data, consent withdrawal requests, privacy policy questions and clarifications, data retention questions, cookies and tracking preferences, international data transfer concerns, objections to data processing, automated decision-making questions, and data breach notifications or concerns.
• Expected response time: Within 30 days as required by Rwandan Data Protection Law, though we typically respond much faster for straightforward requests. Complex requests may take up to 60 days, with notification of the extension provided within the initial 30 days.
• Subject line guidance: For faster processing, use clear subject lines like "Data Access Request," "Right to Erasure Request," "Privacy Policy Question," or "Consent Withdrawal Request."

Legal Matters and Compliance
For legal correspondence, compliance questions, and formal legal requests:
• Email: legal@amoriaglobal.com
• Use this contact for: Legal compliance questions (GDPR, Rwanda DPPL, etc.), law enforcement requests and legal process, regulatory inquiries and compliance matters, contractual questions related to data processing, Standard Contractual Clauses (SCC) questions, legal disputes or formal complaints, subpoenas, court orders, or warrants, and formal legal correspondence from attorneys or regulators.
• Expected response time: Variable depending on the nature of the legal matter. Urgent legal matters receive priority attention, while complex compliance questions may require coordination with legal counsel.
• Note: For law enforcement requests, please follow proper legal channels and include appropriate legal documentation. We cooperate with legitimate legal processes while protecting user rights to the fullest extent permitted by law.

Customer Support
For technical assistance, account issues, and general support:
• Email: support@connekyt.com
• Use this contact for: Technical issues and platform bugs, account access problems (login issues, password resets), booking and payment support, profile and portfolio management help, communication and messaging issues, dispute resolution assistance, report violations of terms of service or community guidelines, and general troubleshooting and assistance.
• Expected response time: Within 24-48 hours for most support requests. Urgent issues affecting account access or payment processing are prioritized and typically addressed within 24 hours. Complex technical issues may require additional time for investigation and resolution.
• Support hours: Our support team operates during business hours (Kigali time zone, UTC+2) with extended hours for urgent matters.

Specialized Contact Guidance

For Data Subject Rights Requests
When exercising your rights under Rwanda's Data Protection and Privacy Law or GDPR, please provide the following information to help us process your request efficiently:
• Your full name as registered in your account
• Your registered email address
• Your account username or ID (if known)
• Specific right you wish to exercise (access, rectification, erasure, restriction, portability, objection)
• Clear description of your request, including what data or processing you're concerned about
• Any relevant account details or context that helps us locate and verify your information
• Preferred format for data delivery (for access and portability requests): JSON, CSV, or PDF
• Identity verification information (we'll request additional verification if needed to protect your data)

We take identity verification seriously to prevent unauthorized access to your data. For most requests, email verification and account details are sufficient. For sensitive requests (like data access or deletion), we may request additional verification such as answering security questions, providing a government-issued ID, or confirming recent account activity.

For Privacy Policy Questions
If you have questions about this Privacy Policy or our data practices, you don't need to provide extensive details. Just ask your question clearly. We welcome questions like:
• "Can you explain what 'legitimate interest' means in section X?"
• "How long do you retain my transaction records?"
• "Who are your payment processors and where are they located?"
• "Can I opt out of analytics cookies while still using your platform?"
• "What happens to my data if I close my account?"

No question is too simple or too complex. We're here to help you understand how we handle your information.

For Complaints and Concerns
If you have complaints about our privacy practices or concerns about how your data has been handled, please contact privacy@amoriaglobal.com with:
• Detailed description of the issue or concern
• When the issue occurred (dates, times if relevant)
• What specific privacy practice or policy provision you believe was violated
• What impact the issue has had on you
• What resolution or remedy you're seeking
• Any supporting documentation (screenshots, emails, etc.)

We take complaints seriously and will investigate thoroughly, respond with our findings and any corrective actions, work with you to resolve the issue cooperatively, and escalate internally if necessary to ensure proper handling. If you're unsatisfied with our response, you have the right to escalate to Rwanda's National Cyber Security Authority (NCSA) or other appropriate supervisory authorities.

Response Time Commitments

We commit to the following response timeframes:
• Privacy rights requests: Within 30 days as required by Rwandan law (typically much faster)
• Urgent security matters: Within 24 hours
• Customer support issues: Within 24-48 hours
• General inquiries: Within 48-72 hours
• Legal matters: Variable based on urgency and complexity
• Complex requests requiring investigation: Up to 60 days with notification of extension within initial 30 days

These are maximum timeframes. We typically respond much faster. If we need additional time or information to fully address your request, we'll communicate this promptly and provide regular updates on progress.

What to Expect When You Contact Us

When you reach out, you can expect professional, respectful communication from knowledgeable team members who understand privacy and data protection. We'll acknowledge receipt of your inquiry, typically within 24-48 hours, confirming we received your message and providing an estimated timeline for full response. We'll verify your identity when necessary to protect your data from unauthorized access, requesting appropriate verification based on the sensitivity of your request.

We provide clear, comprehensive responses in plain language without unnecessary legal jargon, explaining what we've done in response to your request, what information we can or cannot provide and why, what your options are going forward, and who to contact if you have follow-up questions. If we cannot fully comply with a request, we'll explain why clearly, cite specific legal provisions or limitations that prevent compliance, offer alternatives where possible, and inform you of your right to appeal or escalate to supervisory authorities.

We maintain confidentiality throughout, ensuring your communications and personal information are handled securely and only accessed by authorized personnel who need to respond to your inquiry. All communications are encrypted in transit, stored securely, and treated as confidential.

Follow-up and Escalation

If you're unsatisfied with our initial response, you have several options:
• Reply to our response asking for clarification or further explanation. We're happy to continue the dialogue
• Request escalation to a supervisor or senior privacy officer for additional review
• File a complaint with Rwanda's National Cyber Security Authority (NCSA) at www.ncsa.gov.rw
• For EU residents, contact your local data protection authority
• Seek legal advice or representation if you believe your rights have been violated

We prefer to resolve issues cooperatively and directly, but we respect your right to escalate through appropriate channels if necessary.

Additional Resources

For additional information about privacy, data protection, and your rights:
• Rwanda's National Cyber Security Authority (NCSA): www.ncsa.gov.rw - For information about Rwanda's Data Protection and Privacy Law, filing complaints, and understanding your rights
• European Data Protection Board (EDPB): edpb.europa.eu - For GDPR-related information and guidance (for EU users)
• Data Protection Authorities: Each country has its own data protection authority that can provide guidance and handle complaints
• Our Privacy Policy: Comprehensive information about our data practices is available on our website at www.connekyt.com/user/privacy-policy
• Our Terms of Service: Available at www.connekyt.com/user/terms-of-service
• Help Center: www.connekyt.com/user/help-center for FAQs and self-service resources

Languages and Accessibility

We primarily communicate in English, but we can accommodate requests in French and Kinyarwanda where possible. If you need assistance in a language other than English, please indicate this in your initial contact, and we'll do our best to provide appropriate language support.

If you have accessibility needs that affect how you communicate with us, please let us know so we can accommodate them appropriately. We're committed to ensuring our privacy practices and communications are accessible to all users.

Security of Communications

All email communications with us are transmitted over encrypted connections where supported by your email provider. For highly sensitive information, we recommend using encrypted email services or contacting us to arrange secure file transfer methods. Never send sensitive information like passwords, full credit card numbers, or complete government ID documents via unencrypted email unless we specifically request it through a secure channel.

Our Commitment to Accessibility

We're committed to being accessible, responsive, and helpful. Privacy shouldn't be complex or intimidating, and exercising your rights shouldn't require jumping through hoops. We've designed our contact processes to be straightforward, user-friendly, and responsive to your needs. When you reach out, you'll encounter real people who care about your privacy and are empowered to help you.

Thank you for trusting Amoria Connekyt with your personal information. We don't take that trust lightly, and we're here to ensure your data is protected, your rights are respected, and your concerns are addressed.

Legal Entity Information

Amoria Global Tech Ltd.
Registered in Rwanda
Registration Number: [Company Registration Number]
Registered Office: Kigali, Rwanda
Data Protection Registration: Registered with National Cyber Security Authority (NCSA)

For formal legal correspondence, please direct mail to our registered office or email legal@amoriaglobal.com for proper routing.

Effective Date and Policy Information

This Privacy Policy was last updated on 01 March 2026.
Version: 2026.03.01
Previous versions available upon request for comparison and transparency purposes.

© 2026 Amoria Global Tech Ltd. | All Rights Reserved`
    }
];

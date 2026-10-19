export const batch1En = {
  // verify-totp.tsx
  b1_verifyTotpFailed: 'Verification failed. Try again.',
  b1_verifyTotpTitle: 'Two-Factor Authentication',
  b1_verifyTotpSubtitle: 'Open your authenticator app and enter the 6-digit code to sign in.',
  b1_verifyTotpCodeLabel: 'Verification code',
  b1_verifyTotpButton: 'Verify Code',
  b1_verifyTotpInfo:
    'Open Google Authenticator, Authy, or your preferred authenticator app to find your code. The code refreshes every 30 seconds.',

  // terms.tsx
  b1_termsSec1Title: '1. Acceptance',
  b1_termsSec1Body:
    'By creating an account or using Connekyt you agree to these Terms & Conditions and our Privacy Policy. If you do not agree, please do not use the app.',
  b1_termsSec2Title: '2. Your account',
  b1_termsSec2Body:
    'You are responsible for the accuracy of the information you provide and for keeping your login secure. You must be old enough to enter a binding contract in your country.',
  b1_termsSec3Title: '3. Bookings & payments',
  b1_termsSec3Body:
    'Payments are processed by our payment partners. Booking deposits may be held in escrow and released to photographers on event completion. Fees and commissions are shown before you pay.',
  b1_termsSec4Title: '4. Content & albums',
  b1_termsSec4Body:
    'Photographers retain rights to their work. Purchased photos are licensed to you for personal use. Do not upload content you do not have the rights to, and respect others’ privacy.',
  b1_termsSec5Title: '5. Live streams',
  b1_termsSec5Body:
    'Live chat and reactions must remain respectful. We may remove content or restrict accounts that breach community standards or applicable law.',
  b1_termsSec6Title: '6. Refunds & disputes',
  b1_termsSec6Body:
    'If a paid service is not delivered, you may be eligible for a refund per our policy. Contact support to raise a dispute; escrowed funds help protect both parties.',
  b1_termsSec7Title: '7. Changes',
  b1_termsSec7Body:
    'We may update these terms from time to time. Continued use after an update means you accept the revised terms.',
  b1_termsTitle: 'Terms & Conditions',
  b1_termsSubtitle: 'Please review and accept to continue.',
  b1_termsEyebrow: 'BEFORE YOU START',
  b1_termsAcceptBtn: 'I agree & continue',

  // edit-profile.tsx
  b1_editProfileUploadPhotoErr: 'Could not upload the photo.',
  b1_editProfileUploadCoverErr: 'Could not upload the cover photo.',
  b1_editProfileNameRequiredErr: 'First and last name are required.',
  b1_editProfileInvalidPhoneErr: 'Enter a valid phone number.',
  b1_editProfileSaveErr: 'Could not save your changes.',
  b1_editProfileAddCover: 'Add cover photo',
  b1_editProfileFirstName: 'First name',
  b1_editProfileLastName: 'Last name',
  b1_editProfilePhone: 'Phone',
  b1_editProfileOrgTitle: 'Organization & Business',
  b1_editProfileOrgSubtitle: 'Details shown on events and coordinator profile.',
  b1_editProfileOrgNameLabel: 'Organization / Company name',
  b1_editProfileOrgNamePlaceholder: 'e.g. Kigali Events Ltd',
  b1_editProfileBizTypeLabel: 'Business type',
  b1_editProfileBizTypePlaceholder: 'e.g. Event Management / Production',
  b1_editProfileBizAddrLabel: 'Business address',
  b1_editProfileBizAddrPlaceholder: 'e.g. KG 9 Ave, Nyarugenge, Kigali',
  b1_editProfileWebsiteLabel: 'Website',
  b1_editProfileWebsitePlaceholder: 'https://example.com',
  b1_editProfileTaxIdLabel: 'Tax ID / TIN (Optional)',
  b1_editProfileTaxIdPlaceholder: 'e.g. 102345678',
  b1_editProfileSaveBtn: 'Save changes',

  // payment-accounts.tsx
  b1_payAccUpdateErrTitle: 'Could not update',
  b1_payAccTryAgainMsg: 'Please try again.',
  b1_payAccRemoveTitle: 'Remove this account?',
  b1_payAccRemoveBody: '{label} {number} will no longer be available for withdrawals.',
  b1_payAccCancel: 'Cancel',
  b1_payAccRemove: 'Remove',
  b1_payAccRemoveErrTitle: 'Could not remove',
  b1_payAccTitle: 'Payment accounts',
  b1_payAccSubtitle: 'Manage the accounts you use for payments and withdrawals.',
  b1_payAccLoading: 'Loading your accounts…',
  b1_payAccLoadErrTitle: 'Could not load your accounts',
  b1_payAccTryAgainBtn: 'Try again',
  b1_payAccEmptyTitle: 'No payment accounts saved',
  b1_payAccEmptyBody: 'Add a mobile money or bank account to enable payments and withdrawals.',
  b1_payAccAddBtn: 'Add account',
  b1_payAccCountOne: '1 saved account',
  b1_payAccCountMany: '{count} saved accounts',
  b1_payAccDefault: 'Default',
  b1_payAccMakeDefaultA11y: 'Make {label} your default account',
  b1_payAccMakeDefault: 'Make default',
  b1_payAccRemoveA11y: 'Remove {label}',
  b1_payAccAddAnotherBtn: 'Add another account',

  // two-factor.tsx
  b1_twoFactorSetupErr: 'Could not start setup.',
  b1_twoFactorEnableErr: 'Could not enable two-factor.',
  b1_twoFactorDisableErr: 'Could not disable two-factor.',
  b1_twoFactorTitle: 'Two-factor authentication',
  b1_twoFactorSubtitle: 'Add an extra layer of security',
  b1_twoFactorStatusOn: 'Two-factor is ON',
  b1_twoFactorStatusOff: 'Two-factor is OFF',
  b1_twoFactorDisableBody: 'Enter a code from your authenticator app to turn two-factor off.',
  b1_twoFactorAuthCodeLabel: 'Authenticator code',
  b1_twoFactorDisableBtn: 'Disable two-factor',
  b1_twoFactorScanBody:
    'Scan this QR code with Google Authenticator (or any TOTP app), then enter the 6-digit code to finish.',
  b1_twoFactorManualKey: 'Or enter this key manually:',
  b1_twoFactorSixDigitLabel: '6-digit code',
  b1_twoFactorVerifyBtn: 'Verify & enable',
  b1_twoFactorIntroBody:
    "Protect your account with an authenticator app. You'll enter a 6-digit code when signing in.",
  b1_twoFactorEnableBtn: 'Enable two-factor',

  // blocked-accounts.tsx
  b1_blockedLoadErr: 'Could not load your blocked accounts.',
  b1_blockedUnblockTitle: 'Unblock {name}?',
  b1_blockedUnblockBody:
    'You will see their messages again, and they will be able to message you.',
  b1_blockedCancel: 'Cancel',
  b1_blockedUnblock: 'Unblock',
  b1_blockedUnblockErrTitle: 'Could not unblock',
  b1_blockedTryAgain: 'Please try again.',
  b1_blockedTitle: 'Blocked accounts',
  b1_blockedSubtitle:
    "People you've blocked can't message you, and you won't see their messages.",
  b1_blockedEmptyTitle: 'No blocked accounts',
  b1_blockedEmptyBody:
    "When you block someone from a chat or profile, they'll show up here.",
  b1_blockedWorking: 'Working…',

  // delete-account.tsx
  b1_deleteConsequence1: 'Your profile, name, email, and phone number are permanently removed.',
  b1_deleteConsequence2: 'You lose access to your bookings, purchased photos, and streams.',
  b1_deleteConsequence3: 'Your photos and identity documents are deleted from your account.',
  b1_deleteConsequence4: 'This cannot be undone. You will need to create a new account to return.',
  b1_deleteErr: 'Could not delete your account. Please try again.',
  b1_deleteTitle: 'Delete your account',
  b1_deleteSubtitle:
    'Deleting your Connekyt account is permanent. Please read what happens before you continue.',
  b1_deleteNote:
    'Some transaction records may be retained where required by law, but they are no longer linked to your personal information.',
  b1_deleteTypePrefix: 'Type',
  b1_deleteTypeSuffix: 'to confirm',
  b1_deleteBtn: 'Permanently delete my account',

  // tv-devices.tsx
  b1_tvDisconnectTitle: 'Disconnect TV',
  b1_tvDisconnectBody: 'Remove "{label}" from your account?',
  b1_tvCancel: 'Cancel',
  b1_tvDisconnect: 'Disconnect',
  b1_tvTitle: 'Manage TVs',
  b1_tvSubtitle: 'TVs connected to your Connekyt account',
  b1_tvConnectBtn: 'Connect a new TV',
  b1_tvPayTitle: 'Pay for a stream on a TV',
  b1_tvPaySub: 'Scan the payment QR your TV shows and pay from here.',
  b1_tvEmptyTitle: 'No TVs connected',
  b1_tvEmptyBody: "Scan the QR code on your Smart TV's login screen to connect it.",
  b1_tvPairedAt: 'Paired {pairedAt}',
  b1_tvLastSeenAt: 'last seen {lastSeenAt}',

  // connect-to-tv.tsx
  b1_connectTvErr: 'Could not connect to that TV.',
  b1_connectTvCloseA11y: 'Close',
  b1_connectTvTitle: 'Connect to TV',
  b1_connectTvSubtitle: 'Point your camera at the QR code on your TV',
  b1_connectTvPermBody: "Connekyt needs camera access to scan your TV's QR code.",
  b1_connectTvAllowCameraBtn: 'Allow camera access',
  b1_connectTvCancelBtn: 'Cancel',
  b1_connectTvCloseScannerA11y: 'Close scanner',
  b1_connectTvConnecting: 'Connecting to your TV…',
  b1_connectTvSuccess: 'TV connected!',
  b1_connectTvScanAgainBtn: 'Scan again',

  // pay-on-tv.tsx
  b1_payTvFree: 'Free',
  b1_payTvInvalidQr:
    "That QR isn't a Connekyt pay-to-watch code. Point at the code your TV shows.",
  b1_payTvCloseA11y: 'Close',
  b1_payTvTitle: 'Pay on TV',
  b1_payTvSubtitle: 'Scan the payment QR shown on your TV',
  b1_payTvPermBody: 'Connekyt needs camera access to scan the QR on your TV.',
  b1_payTvAllowCameraBtn: 'Allow camera access',
  b1_payTvCancelBtn: 'Cancel',
  b1_payTvCloseScannerA11y: 'Close scanner',
  b1_payTvDefaultStreamTitle: 'This stream',
  b1_payTvLoadErr: 'Could not load this stream.',
  b1_payTvLoadingSubtitle: 'Loading stream…',
  b1_payTvScanAgainBtn: 'Scan again',
  b1_payTvUnlockSubtitle: 'Unlock this stream on your Smart TV',
  b1_payTvBadge: 'PAYING FOR YOUR TV',
  b1_payTvAmountLabel: 'Amount',
  b1_payTvHandedOffBody:
    "Finish the payment in the page that opened. Once it's confirmed, your TV unlocks on its own, which can take a few seconds. You can close this screen.",
  b1_payTvStep1: 'Scanned the code your TV is showing.',
  b1_payTvStep2: 'Pay securely in the app.',
  b1_payTvStep3: 'Your TV unlocks automatically once paid.',
  b1_payTvDisabledBody:
    "Paid streams can't be purchased in the app. If you already have an invite code, you can enter it on your TV.",
  b1_payTvDoneBtn: 'Done',
  b1_payTvPayBtn: 'Pay {amount}',
  b1_payTvCloseBtn: 'Close',
  b1_payTvRescanLink: 'Scan a different TV',
  b1_payTvSecureNote: 'Payment is completed securely in the app',
} as const;

export const batch1Fr: Record<keyof typeof batch1En, string> = {
  // verify-totp.tsx
  b1_verifyTotpFailed: 'La vérification a échoué. Réessayez.',
  b1_verifyTotpTitle: 'Authentification à deux facteurs',
  b1_verifyTotpSubtitle:
    'Ouvrez votre application d’authentification et saisissez le code à 6 chiffres pour vous connecter.',
  b1_verifyTotpCodeLabel: 'Code de vérification',
  b1_verifyTotpButton: 'Vérifier le code',
  b1_verifyTotpInfo:
    'Ouvrez Google Authenticator, Authy ou votre application d’authentification préférée pour trouver votre code. Le code s’actualise toutes les 30 secondes.',

  // terms.tsx
  b1_termsSec1Title: '1. Acceptation',
  b1_termsSec1Body:
    'En créant un compte ou en utilisant Connekyt, vous acceptez ces Conditions générales et notre Politique de confidentialité. Si vous n’êtes pas d’accord, veuillez ne pas utiliser l’application.',
  b1_termsSec2Title: '2. Votre compte',
  b1_termsSec2Body:
    'Vous êtes responsable de l’exactitude des informations fournies et de la sécurité de vos identifiants. Vous devez avoir l’âge légal pour conclure un contrat contraignant dans votre pays.',
  b1_termsSec3Title: '3. Réservations et paiements',
  b1_termsSec3Body:
    'Les paiements sont traités par nos partenaires de paiement. Les acomptes de réservation peuvent être conservés sous séquestre et versés aux photographes une fois l’événement terminé. Les frais et commissions sont affichés avant le paiement.',
  b1_termsSec4Title: '4. Contenu et albums',
  b1_termsSec4Body:
    'Les photographes conservent les droits sur leurs œuvres. Les photos achetées vous sont concédées sous licence pour un usage personnel. Ne téléversez pas de contenu dont vous ne détenez pas les droits et respectez la vie privée d’autrui.',
  b1_termsSec5Title: '5. Diffusions en direct',
  b1_termsSec5Body:
    'Le chat en direct et les réactions doivent rester respectueux. Nous pouvons supprimer du contenu ou restreindre les comptes qui enfreignent les règles de la communauté ou la loi applicable.',
  b1_termsSec6Title: '6. Remboursements et litiges',
  b1_termsSec6Body:
    'Si un service payé n’est pas fourni, vous pouvez avoir droit à un remboursement selon notre politique. Contactez le support pour ouvrir un litige ; les fonds sous séquestre protègent les deux parties.',
  b1_termsSec7Title: '7. Modifications',
  b1_termsSec7Body:
    'Nous pouvons mettre à jour ces conditions de temps à autre. Continuer à utiliser l’application après une mise à jour signifie que vous acceptez les conditions révisées.',
  b1_termsTitle: 'Conditions générales',
  b1_termsSubtitle: 'Veuillez lire et accepter pour continuer.',
  b1_termsEyebrow: 'AVANT DE COMMENCER',
  b1_termsAcceptBtn: 'J’accepte et je continue',

  // edit-profile.tsx
  b1_editProfileUploadPhotoErr: 'Impossible de téléverser la photo.',
  b1_editProfileUploadCoverErr: 'Impossible de téléverser la photo de couverture.',
  b1_editProfileNameRequiredErr: 'Le prénom et le nom sont obligatoires.',
  b1_editProfileInvalidPhoneErr: 'Saisissez un numéro de téléphone valide.',
  b1_editProfileSaveErr: 'Impossible d’enregistrer vos modifications.',
  b1_editProfileAddCover: 'Ajouter une photo de couverture',
  b1_editProfileFirstName: 'Prénom',
  b1_editProfileLastName: 'Nom',
  b1_editProfilePhone: 'Téléphone',
  b1_editProfileOrgTitle: 'Organisation et entreprise',
  b1_editProfileOrgSubtitle: 'Détails affichés sur les événements et le profil de coordinateur.',
  b1_editProfileOrgNameLabel: 'Nom de l’organisation / entreprise',
  b1_editProfileOrgNamePlaceholder: 'ex. Kigali Events Ltd',
  b1_editProfileBizTypeLabel: 'Type d’activité',
  b1_editProfileBizTypePlaceholder: 'ex. Gestion d’événements / Production',
  b1_editProfileBizAddrLabel: 'Adresse professionnelle',
  b1_editProfileBizAddrPlaceholder: 'ex. KG 9 Ave, Nyarugenge, Kigali',
  b1_editProfileWebsiteLabel: 'Site web',
  b1_editProfileWebsitePlaceholder: 'https://example.com',
  b1_editProfileTaxIdLabel: 'Numéro fiscal / NIF (Optionnel)',
  b1_editProfileTaxIdPlaceholder: 'ex. 102345678',
  b1_editProfileSaveBtn: 'Enregistrer les modifications',

  // payment-accounts.tsx
  b1_payAccUpdateErrTitle: 'Mise à jour impossible',
  b1_payAccTryAgainMsg: 'Veuillez réessayer.',
  b1_payAccRemoveTitle: 'Supprimer ce compte ?',
  b1_payAccRemoveBody: '{label} {number} ne sera plus disponible pour les retraits.',
  b1_payAccCancel: 'Annuler',
  b1_payAccRemove: 'Supprimer',
  b1_payAccRemoveErrTitle: 'Suppression impossible',
  b1_payAccTitle: 'Comptes de paiement',
  b1_payAccSubtitle: 'Gérez les comptes que vous utilisez pour les paiements et les retraits.',
  b1_payAccLoading: 'Chargement de vos comptes…',
  b1_payAccLoadErrTitle: 'Impossible de charger vos comptes',
  b1_payAccTryAgainBtn: 'Réessayer',
  b1_payAccEmptyTitle: 'Aucun compte de paiement enregistré',
  b1_payAccEmptyBody:
    'Ajoutez un compte Mobile Money ou bancaire pour activer les paiements et les retraits.',
  b1_payAccAddBtn: 'Ajouter un compte',
  b1_payAccCountOne: '1 compte enregistré',
  b1_payAccCountMany: '{count} comptes enregistrés',
  b1_payAccDefault: 'Par défaut',
  b1_payAccMakeDefaultA11y: 'Définir {label} comme compte par défaut',
  b1_payAccMakeDefault: 'Définir par défaut',
  b1_payAccRemoveA11y: 'Supprimer {label}',
  b1_payAccAddAnotherBtn: 'Ajouter un autre compte',

  // two-factor.tsx
  b1_twoFactorSetupErr: 'Impossible de démarrer la configuration.',
  b1_twoFactorEnableErr: 'Impossible d’activer la double authentification.',
  b1_twoFactorDisableErr: 'Impossible de désactiver la double authentification.',
  b1_twoFactorTitle: 'Authentification à deux facteurs',
  b1_twoFactorSubtitle: 'Ajoutez une couche de sécurité supplémentaire',
  b1_twoFactorStatusOn: 'La double authentification est ACTIVÉE',
  b1_twoFactorStatusOff: 'La double authentification est DÉSACTIVÉE',
  b1_twoFactorDisableBody:
    'Saisissez un code de votre application d’authentification pour désactiver la double authentification.',
  b1_twoFactorAuthCodeLabel: 'Code d’authentification',
  b1_twoFactorDisableBtn: 'Désactiver la double authentification',
  b1_twoFactorScanBody:
    'Scannez ce code QR avec Google Authenticator (ou toute application TOTP), puis saisissez le code à 6 chiffres pour terminer.',
  b1_twoFactorManualKey: 'Ou saisissez cette clé manuellement :',
  b1_twoFactorSixDigitLabel: 'Code à 6 chiffres',
  b1_twoFactorVerifyBtn: 'Vérifier et activer',
  b1_twoFactorIntroBody:
    'Protégez votre compte avec une application d’authentification. Vous saisirez un code à 6 chiffres lors de la connexion.',
  b1_twoFactorEnableBtn: 'Activer la double authentification',

  // blocked-accounts.tsx
  b1_blockedLoadErr: 'Impossible de charger vos comptes bloqués.',
  b1_blockedUnblockTitle: 'Débloquer {name} ?',
  b1_blockedUnblockBody:
    'Vous verrez à nouveau ses messages et cette personne pourra vous envoyer des messages.',
  b1_blockedCancel: 'Annuler',
  b1_blockedUnblock: 'Débloquer',
  b1_blockedUnblockErrTitle: 'Impossible de débloquer',
  b1_blockedTryAgain: 'Veuillez réessayer.',
  b1_blockedTitle: 'Comptes bloqués',
  b1_blockedSubtitle:
    'Les personnes que vous avez bloquées ne peuvent pas vous envoyer de messages et vous ne verrez pas les leurs.',
  b1_blockedEmptyTitle: 'Aucun compte bloqué',
  b1_blockedEmptyBody:
    'Lorsque vous bloquez quelqu’un depuis une discussion ou un profil, il apparaît ici.',
  b1_blockedWorking: 'En cours…',

  // delete-account.tsx
  b1_deleteConsequence1:
    'Votre profil, votre nom, votre e-mail et votre numéro de téléphone sont définitivement supprimés.',
  b1_deleteConsequence2:
    'Vous perdez l’accès à vos réservations, vos photos achetées et vos diffusions.',
  b1_deleteConsequence3:
    'Vos photos et documents d’identité sont supprimés de votre compte.',
  b1_deleteConsequence4:
    'Cette action est irréversible. Vous devrez créer un nouveau compte pour revenir.',
  b1_deleteErr: 'Impossible de supprimer votre compte. Veuillez réessayer.',
  b1_deleteTitle: 'Supprimer votre compte',
  b1_deleteSubtitle:
    'La suppression de votre compte Connekyt est définitive. Veuillez lire ce qui se passe avant de continuer.',
  b1_deleteNote:
    'Certains relevés de transactions peuvent être conservés lorsque la loi l’exige, mais ils ne sont plus liés à vos informations personnelles.',
  b1_deleteTypePrefix: 'Tapez',
  b1_deleteTypeSuffix: 'pour confirmer',
  b1_deleteBtn: 'Supprimer définitivement mon compte',

  // tv-devices.tsx
  b1_tvDisconnectTitle: 'Déconnecter le téléviseur',
  b1_tvDisconnectBody: 'Supprimer « {label} » de votre compte ?',
  b1_tvCancel: 'Annuler',
  b1_tvDisconnect: 'Déconnecter',
  b1_tvTitle: 'Gérer les téléviseurs',
  b1_tvSubtitle: 'Téléviseurs connectés à votre compte Connekyt',
  b1_tvConnectBtn: 'Connecter un nouveau téléviseur',
  b1_tvPayTitle: 'Payer une diffusion sur un téléviseur',
  b1_tvPaySub: 'Scannez le code QR de paiement affiché sur votre téléviseur et payez depuis ici.',
  b1_tvEmptyTitle: 'Aucun téléviseur connecté',
  b1_tvEmptyBody:
    'Scannez le code QR sur l’écran de connexion de votre Smart TV pour la connecter.',
  b1_tvPairedAt: 'Associé le {pairedAt}',
  b1_tvLastSeenAt: 'vu pour la dernière fois le {lastSeenAt}',

  // connect-to-tv.tsx
  b1_connectTvErr: 'Impossible de se connecter à ce téléviseur.',
  b1_connectTvCloseA11y: 'Fermer',
  b1_connectTvTitle: 'Connecter au téléviseur',
  b1_connectTvSubtitle: 'Pointez votre caméra vers le code QR sur votre téléviseur',
  b1_connectTvPermBody:
    'Connekyt a besoin d’accéder à la caméra pour scanner le code QR de votre téléviseur.',
  b1_connectTvAllowCameraBtn: 'Autoriser l’accès à la caméra',
  b1_connectTvCancelBtn: 'Annuler',
  b1_connectTvCloseScannerA11y: 'Fermer le scanner',
  b1_connectTvConnecting: 'Connexion à votre téléviseur…',
  b1_connectTvSuccess: 'Téléviseur connecté !',
  b1_connectTvScanAgainBtn: 'Scanner à nouveau',

  // pay-on-tv.tsx
  b1_payTvFree: 'Gratuit',
  b1_payTvInvalidQr:
    'Ce code QR n’est pas un code de paiement Connekyt. Pointez vers le code affiché par votre téléviseur.',
  b1_payTvCloseA11y: 'Fermer',
  b1_payTvTitle: 'Payer sur le téléviseur',
  b1_payTvSubtitle: 'Scannez le code QR de paiement affiché sur votre téléviseur',
  b1_payTvPermBody:
    'Connekyt a besoin d’accéder à la caméra pour scanner le code QR sur votre téléviseur.',
  b1_payTvAllowCameraBtn: 'Autoriser l’accès à la caméra',
  b1_payTvCancelBtn: 'Annuler',
  b1_payTvCloseScannerA11y: 'Fermer le scanner',
  b1_payTvDefaultStreamTitle: 'Cette diffusion',
  b1_payTvLoadErr: 'Impossible de charger cette diffusion.',
  b1_payTvLoadingSubtitle: 'Chargement de la diffusion…',
  b1_payTvScanAgainBtn: 'Scanner à nouveau',
  b1_payTvUnlockSubtitle: 'Débloquez cette diffusion sur votre Smart TV',
  b1_payTvBadge: 'PAIEMENT POUR VOTRE TÉLÉVISEUR',
  b1_payTvAmountLabel: 'Montant',
  b1_payTvHandedOffBody:
    'Terminez le paiement sur la page qui s’est ouverte. Une fois confirmé, votre téléviseur se débloque automatiquement en quelques secondes. Vous pouvez fermer cet écran.',
  b1_payTvStep1: 'Code affiché sur votre téléviseur scanné.',
  b1_payTvStep2: 'Payez en toute sécurité dans l’application.',
  b1_payTvStep3: 'Votre téléviseur se débloque automatiquement une fois le paiement effectué.',
  b1_payTvDisabledBody:
    'Les diffusions payantes ne peuvent pas être achetées dans l’application. Si vous avez déjà un code d’invitation, vous pouvez le saisir sur votre téléviseur.',
  b1_payTvDoneBtn: 'Terminé',
  b1_payTvPayBtn: 'Payer {amount}',
  b1_payTvCloseBtn: 'Fermer',
  b1_payTvRescanLink: 'Scanner un autre téléviseur',
  b1_payTvSecureNote: 'Le paiement est effectué en toute sécurité dans l’application',
} as const;

export const batch1Es: Record<keyof typeof batch1En, string> = {
  // verify-totp.tsx
  b1_verifyTotpFailed: 'La verificación falló. Inténtalo de nuevo.',
  b1_verifyTotpTitle: 'Autenticación de dos factores',
  b1_verifyTotpSubtitle:
    'Abre tu aplicación de autenticación e ingresa el código de 6 dígitos para iniciar sesión.',
  b1_verifyTotpCodeLabel: 'Código de verificación',
  b1_verifyTotpButton: 'Verificar código',
  b1_verifyTotpInfo:
    'Abre Google Authenticator, Authy o tu aplicación de autenticación preferida para encontrar tu código. El código se actualiza cada 30 segundos.',

  // terms.tsx
  b1_termsSec1Title: '1. Aceptación',
  b1_termsSec1Body:
    'Al crear una cuenta o usar Connekyt aceptas estos Términos y Condiciones y nuestra Política de Privacidad. Si no estás de acuerdo, por favor no uses la aplicación.',
  b1_termsSec2Title: '2. Tu cuenta',
  b1_termsSec2Body:
    'Eres responsable de la exactitud de la información que proporcionas y de mantener seguro tu inicio de sesión. Debes tener la edad legal para celebrar un contrato vinculante en tu país.',
  b1_termsSec3Title: '3. Reservas y pagos',
  b1_termsSec3Body:
    'Los pagos son procesados por nuestros socios de pago. Los depósitos de reserva pueden retenerse en garantía y liberarse a los fotógrafos al finalizar el evento. Las tarifas y comisiones se muestran antes de pagar.',
  b1_termsSec4Title: '4. Contenido y álbumes',
  b1_termsSec4Body:
    'Los fotógrafos conservan los derechos sobre su trabajo. Las fotos compradas tienen licencia para tu uso personal. No subas contenido sobre el cual no tengas derechos y respeta la privacidad de los demás.',
  b1_termsSec5Title: '5. Transmisiones en vivo',
  b1_termsSec5Body:
    'El chat en vivo y las reacciones deben seguir siendo respetuosos. Podemos eliminar contenido o restringir cuentas que infrinjan las normas de la comunidad o la ley aplicable.',
  b1_termsSec6Title: '6. Reembolsos y disputas',
  b1_termsSec6Body:
    'Si un servicio pagado no se entrega, puedes ser elegible para un reembolso según nuestra política. Contacta a soporte para presentar una disputa; los fondos en garantía ayudan a proteger a ambas partes.',
  b1_termsSec7Title: '7. Cambios',
  b1_termsSec7Body:
    'Podemos actualizar estos términos de vez en cuando. El uso continuado después de una actualización significa que aceptas los términos revisados.',
  b1_termsTitle: 'Términos y Condiciones',
  b1_termsSubtitle: 'Por favor revisa y acepta para continuar.',
  b1_termsEyebrow: 'ANTES DE EMPEZAR',
  b1_termsAcceptBtn: 'Acepto y continúo',

  // edit-profile.tsx
  b1_editProfileUploadPhotoErr: 'No se pudo subir la foto.',
  b1_editProfileUploadCoverErr: 'No se pudo subir la foto de portada.',
  b1_editProfileNameRequiredErr: 'El nombre y el apellido son obligatorios.',
  b1_editProfileInvalidPhoneErr: 'Ingresa un número de teléfono válido.',
  b1_editProfileSaveErr: 'No se pudieron guardar tus cambios.',
  b1_editProfileAddCover: 'Añadir foto de portada',
  b1_editProfileFirstName: 'Nombre',
  b1_editProfileLastName: 'Apellido',
  b1_editProfilePhone: 'Teléfono',
  b1_editProfileOrgTitle: 'Organización y empresa',
  b1_editProfileOrgSubtitle: 'Detalles mostrados en eventos y en el perfil de coordinador.',
  b1_editProfileOrgNameLabel: 'Nombre de la organización / empresa',
  b1_editProfileOrgNamePlaceholder: 'ej. Kigali Events Ltd',
  b1_editProfileBizTypeLabel: 'Tipo de negocio',
  b1_editProfileBizTypePlaceholder: 'ej. Gestión de eventos / Producción',
  b1_editProfileBizAddrLabel: 'Dirección comercial',
  b1_editProfileBizAddrPlaceholder: 'ej. KG 9 Ave, Nyarugenge, Kigali',
  b1_editProfileWebsiteLabel: 'Sitio web',
  b1_editProfileWebsitePlaceholder: 'https://example.com',
  b1_editProfileTaxIdLabel: 'ID fiscal / TIN (Opcional)',
  b1_editProfileTaxIdPlaceholder: 'ej. 102345678',
  b1_editProfileSaveBtn: 'Guardar cambios',

  // payment-accounts.tsx
  b1_payAccUpdateErrTitle: 'No se pudo actualizar',
  b1_payAccTryAgainMsg: 'Por favor, inténtalo de nuevo.',
  b1_payAccRemoveTitle: '¿Eliminar esta cuenta?',
  b1_payAccRemoveBody: '{label} {number} ya no estará disponible para retiros.',
  b1_payAccCancel: 'Cancelar',
  b1_payAccRemove: 'Eliminar',
  b1_payAccRemoveErrTitle: 'No se pudo eliminar',
  b1_payAccTitle: 'Cuentas de pago',
  b1_payAccSubtitle: 'Administra las cuentas que usas para pagos y retiros.',
  b1_payAccLoading: 'Cargando tus cuentas…',
  b1_payAccLoadErrTitle: 'No se pudieron cargar tus cuentas',
  b1_payAccTryAgainBtn: 'Intentar de nuevo',
  b1_payAccEmptyTitle: 'No hay cuentas de pago guardadas',
  b1_payAccEmptyBody:
    'Añade una cuenta de dinero móvil o bancaria para habilitar pagos y retiros.',
  b1_payAccAddBtn: 'Añadir cuenta',
  b1_payAccCountOne: '1 cuenta guardada',
  b1_payAccCountMany: '{count} cuentas guardadas',
  b1_payAccDefault: 'Predeterminada',
  b1_payAccMakeDefaultA11y: 'Hacer de {label} tu cuenta predeterminada',
  b1_payAccMakeDefault: 'Hacer predeterminada',
  b1_payAccRemoveA11y: 'Eliminar {label}',
  b1_payAccAddAnotherBtn: 'Añadir otra cuenta',

  // two-factor.tsx
  b1_twoFactorSetupErr: 'No se pudo iniciar la configuración.',
  b1_twoFactorEnableErr: 'No se pudo activar la autenticación de dos factores.',
  b1_twoFactorDisableErr: 'No se pudo desactivar la autenticación de dos factores.',
  b1_twoFactorTitle: 'Autenticación de dos factores',
  b1_twoFactorSubtitle: 'Añade una capa adicional de seguridad',
  b1_twoFactorStatusOn: 'La autenticación de dos factores está ACTIVADA',
  b1_twoFactorStatusOff: 'La autenticación de dos factores está DESACTIVADA',
  b1_twoFactorDisableBody:
    'Ingresa un código de tu aplicación de autenticación para desactivar la autenticación de dos factores.',
  b1_twoFactorAuthCodeLabel: 'Código de autenticación',
  b1_twoFactorDisableBtn: 'Desactivar dos factores',
  b1_twoFactorScanBody:
    'Escanea este código QR con Google Authenticator (o cualquier aplicación TOTP) y luego ingresa el código de 6 dígitos para finalizar.',
  b1_twoFactorManualKey: 'O ingresa esta clave manualmente:',
  b1_twoFactorSixDigitLabel: 'Código de 6 dígitos',
  b1_twoFactorVerifyBtn: 'Verificar y activar',
  b1_twoFactorIntroBody:
    'Protege tu cuenta con una aplicación de autenticación. Ingresarás un código de 6 dígitos al iniciar sesión.',
  b1_twoFactorEnableBtn: 'Activar dos factores',

  // blocked-accounts.tsx
  b1_blockedLoadErr: 'No se pudieron cargar tus cuentas bloqueadas.',
  b1_blockedUnblockTitle: '¿Desbloquear a {name}?',
  b1_blockedUnblockBody:
    'Volverás a ver sus mensajes y podrá enviarte mensajes.',
  b1_blockedCancel: 'Cancelar',
  b1_blockedUnblock: 'Desbloquear',
  b1_blockedUnblockErrTitle: 'No se pudo desbloquear',
  b1_blockedTryAgain: 'Por favor, inténtalo de nuevo.',
  b1_blockedTitle: 'Cuentas bloqueadas',
  b1_blockedSubtitle:
    'Las personas que has bloqueado no pueden enviarte mensajes y no verás sus mensajes.',
  b1_blockedEmptyTitle: 'No hay cuentas bloqueadas',
  b1_blockedEmptyBody:
    'Cuando bloquees a alguien desde un chat o perfil, aparecerá aquí.',
  b1_blockedWorking: 'Procesando…',

  // delete-account.tsx
  b1_deleteConsequence1:
    'Tu perfil, nombre, correo electrónico y número de teléfono se eliminan permanentemente.',
  b1_deleteConsequence2:
    'Pierdes el acceso a tus reservas, fotos compradas y transmisiones.',
  b1_deleteConsequence3:
    'Tus fotos y documentos de identidad se eliminan de tu cuenta.',
  b1_deleteConsequence4:
    'Esto no se puede deshacer. Deberás crear una cuenta nueva para regresar.',
  b1_deleteErr: 'No se pudo eliminar tu cuenta. Por favor, inténtalo de nuevo.',
  b1_deleteTitle: 'Eliminar tu cuenta',
  b1_deleteSubtitle:
    'Eliminar tu cuenta de Connekyt es permanente. Por favor, lee lo que sucede antes de continuar.',
  b1_deleteNote:
    'Algunos registros de transacciones pueden conservarse cuando lo exija la ley, pero ya no estarán vinculados a tu información personal.',
  b1_deleteTypePrefix: 'Escribe',
  b1_deleteTypeSuffix: 'para confirmar',
  b1_deleteBtn: 'Eliminar permanentemente mi cuenta',

  // tv-devices.tsx
  b1_tvDisconnectTitle: 'Desconectar TV',
  b1_tvDisconnectBody: '¿Eliminar "{label}" de tu cuenta?',
  b1_tvCancel: 'Cancelar',
  b1_tvDisconnect: 'Desconectar',
  b1_tvTitle: 'Administrar TVs',
  b1_tvSubtitle: 'TVs conectados a tu cuenta de Connekyt',
  b1_tvConnectBtn: 'Conectar un nuevo TV',
  b1_tvPayTitle: 'Pagar una transmisión en un TV',
  b1_tvPaySub: 'Escanea el código QR de pago que muestra tu TV y paga desde aquí.',
  b1_tvEmptyTitle: 'No hay TVs conectados',
  b1_tvEmptyBody:
    'Escanea el código QR en la pantalla de inicio de sesión de tu Smart TV para conectarlo.',
  b1_tvPairedAt: 'Vinculado {pairedAt}',
  b1_tvLastSeenAt: 'visto por última vez {lastSeenAt}',

  // connect-to-tv.tsx
  b1_connectTvErr: 'No se pudo conectar a ese TV.',
  b1_connectTvCloseA11y: 'Cerrar',
  b1_connectTvTitle: 'Conectar a TV',
  b1_connectTvSubtitle: 'Apunta tu cámara al código QR en tu TV',
  b1_connectTvPermBody:
    'Connekyt necesita acceso a la cámara para escanear el código QR de tu TV.',
  b1_connectTvAllowCameraBtn: 'Permitir acceso a la cámara',
  b1_connectTvCancelBtn: 'Cancelar',
  b1_connectTvCloseScannerA11y: 'Cerrar escáner',
  b1_connectTvConnecting: 'Conectando a tu TV…',
  b1_connectTvSuccess: '¡TV conectado!',
  b1_connectTvScanAgainBtn: 'Escanear de nuevo',

  // pay-on-tv.tsx
  b1_payTvFree: 'Gratis',
  b1_payTvInvalidQr:
    'Ese código QR no es un código de pago para ver de Connekyt. Apunta al código que muestra tu TV.',
  b1_payTvCloseA11y: 'Cerrar',
  b1_payTvTitle: 'Pagar en TV',
  b1_payTvSubtitle: 'Escanea el código QR de pago que se muestra en tu TV',
  b1_payTvPermBody:
    'Connekyt necesita acceso a la cámara para escanear el código QR en tu TV.',
  b1_payTvAllowCameraBtn: 'Permitir acceso a la cámara',
  b1_payTvCancelBtn: 'Cancelar',
  b1_payTvCloseScannerA11y: 'Cerrar escáner',
  b1_payTvDefaultStreamTitle: 'Esta transmisión',
  b1_payTvLoadErr: 'No se pudo cargar esta transmisión.',
  b1_payTvLoadingSubtitle: 'Cargando transmisión…',
  b1_payTvScanAgainBtn: 'Escanear de nuevo',
  b1_payTvUnlockSubtitle: 'Desbloquea esta transmisión en tu Smart TV',
  b1_payTvBadge: 'PAGANDO PARA TU TV',
  b1_payTvAmountLabel: 'Monto',
  b1_payTvHandedOffBody:
    'Finaliza el pago en la página que se abrió. Una vez confirmado, tu TV se desbloqueará solo, lo cual puede tardar unos segundos. Puedes cerrar esta pantalla.',
  b1_payTvStep1: 'Se escaneó el código que muestra tu TV.',
  b1_payTvStep2: 'Paga de forma segura en la aplicación.',
  b1_payTvStep3: 'Tu TV se desbloquea automáticamente una vez pagado.',
  b1_payTvDisabledBody:
    'Las transmisiones de pago no se pueden comprar en la aplicación. Si ya tienes un código de invitación, puedes ingresarlo en tu TV.',
  b1_payTvDoneBtn: 'Listo',
  b1_payTvPayBtn: 'Pagar {amount}',
  b1_payTvCloseBtn: 'Cerrar',
  b1_payTvRescanLink: 'Escanear otro TV',
  b1_payTvSecureNote: 'El pago se completa de forma segura en la aplicación',
} as const;

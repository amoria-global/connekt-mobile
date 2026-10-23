/**
 * Kinyarwanda (`rw` — Ikinyarwanda) translations & phrase engine for Connekyt Mobile.
 *
 * Provides:
 * 1. Explicit Kinyarwanda translations for core navigation, auth, onboarding,
 *    dashboards, wallet, payments, withdrawals, events, bookings, KYC, and live studio.
 * 2. Exact phrase dictionary (`SHARED_RW_EXACT`) for `useSharedT().tr(...)` strings.
 * 3. Dynamic regex pattern translations (`translateSharedRw`) for counts, timers,
 *    and period comparisons.
 * 4. Compositional Kinyarwanda phrase translator (`toKinyarwanda`) so every key in
 *    `translations.en`, `batch1`..`batch5`, and local screen `I18N` maps is translated
 *    into Kinyarwanda while preserving `{param}` placeholders.
 */

import { BASE_RW_EXTRA } from './base_rw_extra';
import { batch1Rw, batch2Rw, batch3Rw } from './batch1_3_rw';
import { batch4Rw, batch5Rw } from './batch4_5_rw';
import { SHARED_RW_PART1 } from './shared_rw_1';
import { SHARED_RW_PART2 } from './shared_rw_2';
import { SCREENS_RW_BY_TEXT } from './screens_rw';

export const CORE_RW: Record<string, string> = {
  ...BASE_RW_EXTRA,
  ...batch1Rw,
  ...batch2Rw,
  ...batch3Rw,
  ...batch4Rw,
  ...batch5Rw,
  // Auth & Login
  welcomeBack: 'Murakaza neza nanone',
  signInToAccount: 'Injira muri konti yawe',
  yourEmail: 'Imeyili yawe',
  emailLabel: 'Imeyili cyangwa telefoni',
  emailPlaceholder: 'Andika imeyili yawe',
  passwordLabel: 'Ijambo ry’ibanga',
  passwordPlaceholder: 'Andika ijambo ry’ibanga',
  forgotPassword: 'Wibagiwe ijambo ry’ibanga?',
  forgotYourPassword: 'Wibagiwe ijambo ry’ibanga ryawe?',
  signInBtn: 'Injira',
  logIn: 'Injira',
  signingIn: 'Kwinjira...',
  orContinueWith: 'Cyangwa komeza ukoresheje',
  continueWithGoogle: 'Komeza na Google',
  continueWithApple: 'Komeza na Apple',
  noAccount: 'Nta konti ufite?',
  notRegisteredYet: 'Nturiyandikisha?',
  createAnAccount: 'Fungura konti',
  signUp: 'Iyandikishe',

  // Roles & Choose Role
  roleSheetTitle: 'Uzakoresha ute Connekyt?',
  roleSheetSubtitle: 'Ibi bitunganya konti yawe. Ntushobora kubihindura nyuma, hitamo icyiciro kikubereye.',
  roleClientTitle: 'Umukiriya',
  roleClientBlurb: 'Fata abafotozi, tegura ibirori, kandi usangize amafoto abatumirwa bawe.',
  rolePhotographerTitle: 'Gafotozi',
  rolePhotographerBlurb: 'Erekana ibihangano byawe, bona akazi, kandi wishyurwe mu mutekano.',
  roleCoordinatorTitle: 'Umuhuzabikorwa w’ibirori',
  roleCoordinatorBlurb: 'obora ibirori kuva bitangiye kugeza birangiye kandi uhuze ababikoramo.',
  continueBtn: 'Komeza',
  alreadyHaveAccount: 'Usanzwe ufite konti?',

  // Post notice
  signInToPostEvent: 'Injira kugira ngo utangaze igikorwa cyawe',
  postEventOpens: 'Gutangaza igikorwa birafunguka ukimara kwinjira.',
  newHereCreateAccount: 'Uri mushya hano? Fungura konti',
  postNoticeText: 'Wahisemo gutangaza igikorwa. Injira cyangwa ufungure konti kugira ngo ugitangaze.',
  dismissNotice: 'Funga',
  dismissVerificationBanner: 'Funga itangazo ryo kwemeza',

  // Guest Cards
  exploreWithoutAccount: 'Shakisha nta konti',
  freeAccess: 'UBURENGANZIRA KU BUNTU',
  findMyPhotos: 'Shaka amafoto yanjye',
  selfiePhotoLookup: 'Gushaka amafoto ukoresheje ifoto yawe',
  exploreEvents: 'Shakisha ibirori',
  liveStreamsEvents: 'Imbonankubone n’ibirori',
  aiScan: 'ISUZUMA RYA AI',
  liveAndEvents: 'IMBONANKUBONE N’IBIRORI',

  // Validation
  emailRequired: 'Imeyili irakenewe',
  emailInvalid: 'Andika imeyili yemewe',
  passwordRequired: 'Ijambo ry’ibanga rirakenewe',
  genericError: 'Habaye ikibazo. Ongera ugerageze.',

  // Language Sheet
  languageSheetTitle: 'Ibyifuzo by’ururimi',
  languageSheetSubtitle: 'Hitamo ururimi ukunda gukoresha muri porogaramu',
  selectLanguage: 'Hitamo ururimi',
  done: 'Byakozwe',

  // Bottom Tabs Navigation
  tabHome: 'Ahabanza',
  tabEvents: 'Ibirori',
  tabWallet: 'Ikofi',
  tabInbox: 'Ubutumwa',
  tabProfile: 'Umwirondoro',
  tabMore: 'Ibindi',

  // More Hub & Shortcuts
  searchServices: 'Shakisha serivisi n’ibindi...',
  categoryAll: 'Byose',
  categoryServices: 'Serivisi',
  categoryFinances: 'Imari',
  categoryAccount: 'Konti',
  categorySupport: 'Ubufasha',
  quickActions: 'Ibikorwa byihuse',
  menuLanguage: 'Ururimi',
  menuLanguageHint: 'English, Français, Español, Ikinyarwanda',
  menuSettings: 'Igenamiterere',
  menuSettingsHint: 'Imenyesha n’ibyifuzo bya porogaramu',
  menuAlerts: 'Imenyesha',
  menuAlertsHint: 'Imenyesha riheruka',
  menuSignOut: 'Sohoka',
  menuSignOutHint: 'Sohoka muri konti yawe',
  menuStreams: 'Imbonankubone',
  menuGallery: 'Ububiko bw’amafoto',
  menuPhotographers: 'Shaka Gafotozi',
  menuClients: 'Abakiriya',
  menuCollaborate: 'Gufatanya',
  menuPayments: 'Kwishyura',
  menuTransactions: 'uruhererekane rw’amafaranga',
  menuDonate: 'Tanga inkunga',
  menuOpportunities: 'Amahirwe y’akazi',
  menuPostMyEvent: 'Tangaza igikorwa cyanjye',
  signOutConfirmTitle: 'Sohoka',
  signOutConfirmMessage: 'Urifuza koko gusohoka muri konti yawe?',
  cancel: 'Hagarika',
  confirm: 'Emeza',

  // Profile Screen
  tabPersonalDetails: 'Amakuru bwite',
  tabSettings: 'Igenamiterere',
  tabAccountLegal: 'Konti n’amategeko',
  editProfile: 'Hindura umwirondoro',
  wallet: 'Ikofi',
  verify: 'Emeza',
  gallery: 'Amafoto',
  kycPending: 'KYC Itegereje',
  kycApproved: 'KYC Yemejwe',
  completeYourProfile: 'Uzuza umwirondoro wawe',
  profileCompletionSub: 'Umwirondoro wawe wuzuye ku kigero cya {count}%. Kanda wongereho amakuru.',
  memberSince: 'Umunyamuryango kuva {date}',
  fullName: 'Amazina yombi',
  username: 'Izina rikoreshwa',
  email: 'Imeyili',
  phone: 'Telefoni',
  location: 'Aho uherereye',
  organization: 'Ikigo / Sosiyete',
  specialty: 'Umwihariko',
  accountType: 'Ubwoko bwa konti',
  editPersonalInfo: 'Hindura amakuru yawe bwite',
  notificationSettings: 'Igenamiterere ry’imenyesha',
  notificationSettingsHint: 'Imenyesha kuri telefoni na imeyili',
  notificationsHistory: 'Amateka y’imenyesha',
  notificationsHistoryHint: 'Ibikorwa biheruka',
  paymentAccounts: 'Konti zo kwishyurirwaho',
  paymentAccountsHint: 'Mobile Money na banki byo kubikuzaho',
  twoFactorAuth: 'Umutekano w’intambwe ebyiri (2FA)',
  twoFactorAuthHint: 'Umutekano wisumbuyeho wo kwinjira',
  connectedTvDevices: 'Televiziyo zifatanye',
  connectedTvDevicesHint: 'Huza na televiziyo',
  blockedAccounts: 'Konti zahagaritswe',
  collaborateHint: 'Alubumu usangira n’abandi bafotozi',
  analyticsDashboard: 'Imbonerahamwe y’imibare',
  analyticsDashboardHint: 'Incamake y’imikorere',
  identityVerification: 'Kwemeza umwirondoro',
  appUpdate: 'Kuvugurura porogaramu',
  privacyPolicy: 'Politiki y’ibanga',
  termsOfService: 'Amabwiriza n’amategeko',
  deleteAccount: 'Siba konti',
  languagePreference: 'Ururimi rwa porogaramu',
  languagePreferenceHint: 'Hitamo ururimi rwa porogaramu',
  currencyPreference: 'Ifaranga rigaragazwa',
  currencyPreferenceHint: 'Hitamo ifaranga rigaragazwa',

  // Preferences Screen
  preferencesTitle: 'Imenyesha',
  preferencesSubtitle: 'Hitamo ibyo ushaka kumenyeshwa',
  languageSectionTitle: 'Ibyifuzo by’ururimi',
  languageSectionSubtitle: 'Hitamo ururimi ukoresha muri porogaramu yose',
  currencySectionTitle: 'Ifaranga rigaragazwa',
  currencySectionSubtitle: 'Amafaranga agaragazwa ahinduwe muri iri faranga',
  emailNotificationsTitle: 'Imenyesha kuri imeyili',
  emailNotificationsDesc: 'Amakuru agezweho n’inyemezabwishyu kuri imeyili',
  pushNotificationsTitle: 'Imenyesha kuri telefoni',
  pushNotificationsDesc: 'Imenyesha riza kuri telefoni yawe',
  bookingNotificationsTitle: 'Gufata umwanya (Bookings)',
  bookingNotificationsDesc: 'Ubusabe bushya n’impinduka ku mwanya wafashwe',
  paymentNotificationsTitle: 'Kwishyura',
  paymentNotificationsDesc: 'Kwishyura, kubikuza, no gusubizwa amafaranga',
  albumNotificationsTitle: 'Alubumu n’amafoto',
  albumNotificationsDesc: 'Iyo hari amafoto mashya usangijwe',
  giftNotificationsTitle: 'Impano n’ishimwe',
  giftNotificationsDesc: 'Iyo wakiriye impano cyangwa ishimwe',
  streamFeeNotificationsTitle: 'Imbonankubone (Live)',
  streamFeeNotificationsDesc: 'Uruhushya n’amafaranga yo kureba imbonankubone',
  dndTitle: 'Gasona n’ubwo Do Not Disturb ifunze',
  dndOnDesc: 'Birafunguye. Ubusabe bwo gufata umwanya n’amahirwe birasona nubwo Do Not Disturb iriho.',
  dndOffDesc: 'Birafunze. Kanda ufungure kugira ngo ubusabe bw’akazi bukomeze gusona.',

  // Greetings & Home
  goodMorning: 'Mwaramutse',
  goodAfternoon: 'Mwiriwe',
  goodEvening: 'Mwiriwe',
  goodNight: 'Ijoro ryiza',
  recentActivity: 'Ibikorwa biheruka',
  upcomingEvents: 'Ibirori biri imbere',
  periodToday: 'Uyu munsi',
  periodWeek: 'Iki cyumweru',
  periodMonth: 'Uku kwezi',

  // Onboarding Carousel
  skip: 'Simbuka',
  next: 'Komeza',
  getStarted: 'Tangira',
  onboardingTitle1: 'Impano yawe ikwiriye kugaragara',
  onboardingBody1: 'Bona amahirwe akurikira akomeye. Erekana ubuhanga bwawe, piganirwa ibirori bishya, vugana n’abakiriya kandi uhindure ibihe byiza amahirwe mashya.',
  onboardingTitle2: 'Icyerekezo cyawe. Ibihe bitazibagirana.',
  onboardingBody2: 'Buri kantu kose gafite agaciro. Shakisha ibirori bishya, tanga ibitekerezo byawe, kandi utume buri birori bigenda neza ku bufatanye buhamye.',
  onboardingTitle3: 'Hafi ya buri kanya',
  onboardingBody3: 'Ibirori biza aho uri. Kurikirana ibirori byose imbonankubone aho waba uri hose, sangira ibyishimo n’abakunzi bawe, kandi ntucikwe n’ibihe by’ingenzi.',
  onboardingTitle4: 'Buri foto, ahantu hamwe gusa',
  onboardingBody4: 'Bona amafoto yawe byoroshye ukoresheje kumenya isura, huza n’abafotozi b’inzobere, kandi wongere wishimire ibihe byiza byaranze ibirori witabiriye.',

  // Registration & Signup
  createYourAccount: 'Fungura konti yawe',
  stepCount: 'Intambwe ya {current} kuri {total}',
  firstName: 'Izina ry’idini / Ibanze',
  lastName: 'Izina ry’umuryango',
  phonePlaceholder: 'Andika nimero ya telefoni',
  confirmPassword: 'Emeza ijambo ry’ibanga',
  passwordHelper: 'nibura inyuguti 8 zirimo inyuguti, umubare n’ikimenyetso (@!#$%^&*=+).',
  passwordWeak: 'Riroroshye cyane',
  passwordFair: 'Rigereranije',
  passwordGood: 'Ni ryiza',
  passwordStrong: 'Rikomeye cyane',
  passwordsMatch: 'Amagambo y’ibanga arahura',
  passwordsDontMatch: 'Amagambo y’ibanga ntahura',
  termsNoticePrefix: 'Mu gufungura konti, wemeye',
  termsOfServiceText: 'Amabwiriza ya Serivisi',
  andText: 'ndetse na',
  privacyPolicyText: 'Politiki y’Ibanga',
  alreadyMemberSignIn: 'Usanzwe ufite konti?',
  createAccountBtn: 'Fungura konti',
  continueText: 'Komeza',

  // Stack Headers & Navigation
  navNewEvent: 'Igikorwa gishya',
  navEvent: 'Igikorwa',
  navGeoPricing: 'Ibiciro bijyanye n’akarere',
  navPhotographers: 'Abafotozi',
  navPhotographer: 'Gafotozi',
  navChat: 'Ikiganiro',
  navMyPackages: 'Ibiciro n’amapaki yanjye',
  navNewPackage: 'Ipaki nshya',
  navLiveStreams: 'Imbonankubone',
  navStream: 'Imbonankubone',
  navGoLive: 'Tangira Live',
  navEditProfile: 'Hindura umwirondoro',
  navPreferences: 'Ibyifuzo',
  navNewAlbum: 'Alubumu nshya',
  navAlbum: 'Alubumu',
  navGallery: 'Ububiko bw’amafoto',
  navBookings: 'Imyanya yafashwe',
  navContentAlbums: 'Alubumu z’amafoto',
  navNewContentAlbum: 'Alubumu nshya',
  navPhotobooks: 'Ibitabo by’amafoto',
  navPhotobook: 'Igitabo cy’amafoto',
  navNewPhotobook: 'Igitabo gishya cy’amafoto',
  navWalletMovements: 'Uruhererekane rw’ikofi',
  navWithdraw: 'Kubikuza',
  navPaymentAccounts: 'Konti zo kwishyurirwaho',
  navTransactions: 'Ibyakozwe mu mafaranga',
  navPayrollReport: 'Raporo y’ibyishyuwe',
  navAnalytics: 'Imibare n’isesengura',
  navPayments: 'Kwishyura',
  navPayment: 'Ubwishyu',
  navDonate: 'Tanga inkunga',
  navClients: 'Abakiriya',
  navClient: 'Umukiriya',
  navTwoFactor: 'Umutekano w’intambwe 2',
  navManageTvs: 'Gucunga za TV',
  navConnectToTv: 'Huza na TV',
  navPayOnTv: 'Ishyura kuri TV',
  navDeleteAccount: 'Siba konti',
  navBlockedAccounts: 'Konti zahagaritswe',
  navCollaborate: 'Gufatanya',
  navJoinAlbum: 'Injira muri alubumu',
  navJoinEvent: 'Injira mu gikorwa',
  navBrowsePhotos: 'Shakisha amafoto',
  navHelpCenter: 'Ikigo cy’ubufasha',
  navBookingHelp: 'Ubufasha ku gufata umwanya',
  navMyAccountHelp: 'Ubufasha kuri konti',
  navPaymentMethods: 'Uburyo bwo kwishyura',
  navPaymentHelp: 'Ubufasha ku kwishyura',
  navSecurityHelp: 'Ubufasha ku mutekano',
  navTechnicalSupport: 'Ubufasha bwa tekiniki',
  navContactUs: 'Twandikire',
  navSendFeedback: 'Tanga ibitekerezo',
  navPrivacyPolicy: 'Politiki y’ibanga',
  navTermsConditions: 'Amabwiriza n’amategeko',
  navAbout: 'Ibyerekeye Connekyt',
  navTrustSafety: 'Icyizere n’umutekano',
  navBack: 'Subira inyuma',
  navGoBack: 'Subira inyuma',

  // Wallet Full Translations
  walletEarningsBreakdown: 'Incamake y’inyungu',
  walletSpendingBreakdown: 'Incamake y’ibyasohotse',
  walletBalanceBreakdown: 'Incamake y’amafaranga ariho',
  walletActivity: 'Ibikorwa by’amafaranga',
  showingOf: 'Hagaragazwa {start}–{end} kuri {total}',
  walletSeeAll: 'Reba byose',
  walletSearchActivityPlaceholder: 'Shakisha igikorwa ku mutwe cyangwa ibisobanuro...',
  walletCouldNotLoadHistory: 'Ntibishobotse gufungura amateka yawe',
  walletNoMovementsFound: 'Nta bikorwa by’amafaranga byabonetse',
  walletPullDownTryAgain: 'Kurura umanure wongere ugerageze. Amafaranga yawe ari hejuru arahari neza.',
  walletNoTransactionsMatch: 'Nta gikorwa gihura na "{query}".',
  walletPayoutsAppearHere: 'Amafaranga yabikujwe, ishimwe, n’ubwishyu bizagaragara hano.',
  walletNoCategoryTransactions: 'Nta bikorwa byo mu cyiciro cya {category} biraboneka.',
  walletTransactionDetails: 'Amakuru arambuye ku bwishyu',
  walletCategoryLabel: 'Icyiciro',
  walletDirectionLabel: 'Icyerekezo',
  walletCreditIncoming: 'Ayinjiye (Credit)',
  walletDebitOutgoing: 'Ayasohotse (Debit)',
  walletDateTimeLabel: 'Itariki n’isaha',
  walletOriginalAmountLabel: 'Amafaranga y’umwimerere',
  walletSourceLabel: 'Inkomoko',
  walletNotesLabel: 'Ibisobanuro',
  walletSuspendedPrefix: 'Byahagaritswe:',
  walletAccountSuspended: 'Konti yahagaritswe',
  walletStatusPrefix: 'Ikofi',

  // Shared UI Components
  exploreSheetTitle: 'Shakisha ibirori',
  exploreSheetSubtitle: 'Ni iki wifuza gukora?',
  exploreFastMatch: 'GUHUZA BYIHUSE',
  explorePostYourEvent: 'Tangaza igikorwa cyawe',
  exploreFreePhotographersReply: 'Abafotozi b’inzobere baragusubiza',
  exploreLiveAndPublic: 'IMBONANKUBONE & RUSANGE',
  exploreWatchAndExplore: 'Reba kandi ushakishe',
  exploreLiveStreamsAndPublic: 'Imbonankubone n’ibirori rusange',
  payNowViewerPurchaseNote: 'Ubu ni ubwishyu umusomyi yatangiye ariko atararangiza. Nta kintu usabwa kwishyura.',
  streamLiveBadge: 'LIVE',
  streamStandbyBadge: 'ITEGEREJE',
  streamWatchStream: 'Reba imbonankubone',
  streamBroadcasterFallback: 'Utangaza kuri Connekyt',
  kycOfficialEncrypted: 'Byemewe kandi Birinzwe',
  oppInvited: 'Amahirwe mashya hafi yawe',
  oppApproved: 'Wabyemeye · umukiriya arimo guhitamo',
  oppSelected: 'Wahiswemo',
  oppNotSelected: 'Umukiriya yahisemo undi',
  oppRejected: 'Wabiretse',
  oppExpired: 'Igihe cyarangiye',
  oppWithdrawn: 'Byafunzwe n’umukiriya',
  oppNoLongerAvailable: 'Byarekuwe: ingengabihe yawe iragongana',
  oppDateTbc: 'Itariki izemezwa',
  oppLocationSharedOnBooking: 'Aho bibera hazatangazwa nyuma yo gufata umwanya',
  oppNotThisTime: 'Si ubu',
  oppTimeIsUp: 'Igihe cyarangiye',
  oppYesAvailable: 'Yego, ndahari',
  ...BASE_RW_EXTRA,
};

/**
 * Exact Kinyarwanda phrase dictionary for `useSharedT().tr(...)` and UI labels.
 */
export const SHARED_RW_EXACT: Record<string, string> = {
  ...SCREENS_RW_BY_TEXT,
  ...SHARED_RW_PART1,
  ...SHARED_RW_PART2,
  'Overview': 'Incamake',
  'Schedule': 'Ingengabihe',
  'Goals': 'Intego',
  'All': 'Byose',
  'Day': 'Umunsi',
  'Week': 'Icyumweru',
  'Month': 'Ukwezi',
  'Quarter': 'Igihembwe',
  'Year': 'Umwaka',
  'Today': 'Uyu munsi',
  'Tomorrow': 'Ejo hazaza',
  'This week': 'Iki cyumweru',
  'This month': 'Uku kwezi',
  'Next month': 'Ukwezi gutaha',
  'All dates': 'Amatariki yose',
  'All events': 'Ibirori byose',
  'Live now': 'Live ubu',
  'Live': 'Live',
  'Upcoming': 'Ibiri imbere',
  'Soon': 'Vuba',
  'SOON': 'VUBA',
  'Ended': 'Byarangiye',
  'ENDED': 'BYARANGIYE',
  'UPCOMING': 'IBIRI IMBERE',
  'Recently ended': 'Ibiheruka kurangira',
  'Available': 'Araboneka',
  'AVAILABLE': 'ARABONEKA',
  'Booked': 'Yafashwe',
  'BOOKED': 'YAFASHWE',
  'Available balance': 'Amafaranga aboneka',
  'Pending': 'Bitegereje',
  'Pending clearance': 'Bitegereje kwemezwa',
  'Completed': 'Byakozwe',
  'Failed': 'Byanze',
  'Cancelled': 'Byahagaritswe',
  'Canceled': 'Byahagaritswe',
  'Active': 'Birakora',
  'Confirmed': 'Byemejwe',
  'Declined': 'Byanzwe',
  'Expired': 'Byarangiye igihe',
  'Paid': 'Byishyuwe',
  'Unpaid': 'Ntibirishyurwa',
  'Free': 'Ubuntu',
  'FREE': 'UBUNTU',
  'Ticketed': 'Bisaba itike',
  'From': 'Kuva kuri',
  'To': 'Kugeza kuri',
  'Save': 'Bika',
  'Save changes': 'Bika impinduka',
  'Cancel': 'Hagarika',
  'Confirm': 'Emeza',
  'Close': 'Funga',
  'Done': 'Byakozwe',
  'Back': 'Subira inyuma',
  'Go back': 'Subira inyuma',
  'Go Back': 'Subira inyuma',
  'Next': 'Ibikurikira',
  'Previous': 'Ibibanza',
  'Retry': 'Ongera ugerageze',
  'Try again': 'Ongera ugerageze',
  'Try Again': 'Ongera ugerageze',
  'Edit': 'Hindura',
  'Delete': 'Siba',
  'Remove': 'Kuraho',
  'Share': 'Sangiza',
  'Copy': 'Koporora',
  'Copied': 'Byakoporowe',
  'Search': 'Shakisha',
  'Clear': 'Siba',
  'Clear search': 'Siba ibyo ushakisha',
  'View all': 'Reba byose',
  'See all': 'Reba byose',
  'Show All': 'Erekana byose',
  'View profile': 'Reba umwirondoro',
  'View Details': 'Reba birambuye',
  'View details': 'Reba birambuye',
  'Find Photos': 'Shaka amafoto',
  'Find My Photos': 'Shaka amafoto yanjye',
  'Watch Live': 'Reba Live',
  'Explore Events': 'Shakisha ibirori',
  'Dashboard': 'Imbonerahamwe',
  'Sign In': 'Injira',
  'Sign in': 'Injira',
  'Photographer': 'Gafotozi',
  'Photographers': 'Abafotozi',
  'Client': 'Umukiriya',
  'Clients': 'Abakiriya',
  'Event': 'Igikorwa',
  'Events': 'Ibirori',
  'Bookings': 'Imyanya yafashwe',
  'Booking': 'Umwanya wafashwe',
  'Wallet': 'Ikofi',
  'Payments': 'Kwishyura',
  'Payment': 'Ubwishyu',
  'Withdraw': 'Bikuza',
  'Transactions': 'Ibyakozwe mu mafaranga',
  'Albums': 'Alubumu',
  'Album': 'Alubumu',
  'Photos': 'Amafoto',
  'PHOTOS': 'AMAFOTO',
  'Photobooks': 'Ibitabo by’amafoto',
  'Packages': 'Amapaki n’ibiciro',
  'Package': 'Ipaki',
  'Reviews': 'Ibitekerezo',
  'Review': 'Suzuma',
  'About': 'Ibyerekeye',
  'ABOUT': 'IBYEREKEYE',
  'AVAILABILITY': 'UKO ABONEKA',
  'Book now': 'Fata umwanya ubu',
  'Report photographer': 'Menyesha ikibazo kuri gafotozi',
  'Rebook photographer': 'Ongera ufate uyu gafotozi',
  'KYC Verified': 'KYC Yemejwe',
  'Verify identity': 'Emeza umwirondoro',
  'Choose country': 'Hitamo igihugu',
  'Select country': 'Hitamo igihugu',
  'Choose your country': 'Hitamo igihugu cyawe',
  'Search country or code': 'Shakisha igihugu cyangwa kode',
  'Search country or dial code': 'Shakisha igihugu cyangwa kode ya telefoni',
  'No matching country.': 'Nta gihugu gihuye n’ibyo wanditse.',
  'Events chart unavailable': 'Imbonerahamwe y’ibirori ntibonetse',
  'We could not load this period. Pull down to refresh.': 'Ntibishobotse gufungura iki gihe. Kurura umanure uvugurure.',
  'No events in this period': 'Nta birori biri muri iki gihe',
  'Events you cover will appear here.': 'Ibirori ufotoramo bizagaragara hano.',
  'Matching profile': 'Umwirondoro wo guhuza n’abakiriya',
  'Used to send you Post My Event opportunities': 'Ukoreshwa mu kukoherereza amahirwe y’ibirori byatangajwe',
  'Get matched with more events': 'Huzwa n’ibirori byinshi',
  'Takes 20 seconds': 'Bitwara amasegonda 20',
  'Remind me later': 'Uzanyibutse nyuma',
  'Where are you based?': 'Ukorera he?',
  'So we can send you events near you.': 'Kugira ngo tukoherereze ibirori biri hafi yawe.',
  'Choose your city': 'Hitamo umujyi wawe',
  'Your city': 'Umujyi wawe',
  'Instagram': 'Instagram',
  'Your username or a link, e.g. @yourstudio or instagram.com/yourstudio': 'Izina ryawe cyangwa link, urugero @studiowawe cyangwa instagram.com/studiowawe',
  'Connected. Your profile is used for matching.': 'Byahujwe. Umwirondoro wawe urakoreshwa mu guhuza n’abakiriya.',
  "Saved. We'll check it shortly.": 'Byabitswe. Turabisuzuma mu kanya.',
  "We couldn't find that profile. Check the username and that the account is public.": 'Ntitwabonye uwo mwirondoro. Reba neza izina kandi ko konti ari rusange.',
  'Clients who use Post My Event are matched with photographers automatically. A public Instagram profile helps Connekyt recommend you.': 'Abakiriya bakoresha Tangaza Igikorwa bahuzwa n’abafotozi bako kanya. Konti ya Instagram iri rusange ifasha Connekyt kukumenyekanisha.',
  'We read only your public bio, follower and following counts, and profile photo. We never post, message or ask for your password.': 'Dusoma gusa umwirondoro rusange, umubare w’abakurikira n’ifoto ikuranga. Ntitujya dutangaza cyangwa ngo tukubaze ijambo ry’ibanga.',
  'It is optional and you can remove it at any time.': 'Si itegeko kandi ushobora kubikuraho igihe cyose.',
  'Categories': 'Ibyiciro',
  'All categories': 'Ibyiciro byose',
  'Locations': 'Ahantu',
  'All locations': 'Ahantu hose',
  'Date Range': 'Igihe',
  'Sort Events': 'Tondeka ibirori',
  'Choose an order for exploring events': 'Hitamo uko ibirori bitondekwa',
  'Newest created first': 'Ibishya imbere',
  'Recently booked or created events appear first': 'Ibirori biheruka gufatwa cyangwa gukorwa bigaragara imbere',
  'Oldest created first': 'Ibimaze igihe imbere',
  'Earliest booked or created events first': 'Ibirori byakozwe mbere bigaragara imbere',
  'Event date (Upcoming first)': 'Itariki y’ibirori (Ibiri hafi imbere)',
  'Scheduled event date & time in chronological order': 'Itariki n’isaha y’igikorwa mu buryo bukurikirana',
  'Title (A–Z)': 'Umutwe w’igikorwa (A–Z)',
  'Alphabetical order by event name': 'Uko inyuguti zikurikirana mu izina ry’igikorwa',
  'Search events, venues, categories…': 'Shakisha ibirori, aho bibera, ibyiciro…',
  'SUGGESTIONS': 'IBYIFUZO BY’ISHAKISHA',
  'Page': 'Urupapuro',
  'of': 'kuri',
  'Nothing live right now': 'Nta birori biri live ubu',
  'No events ended recently': 'Nta birori biheruka kurangira',
  'No events coming up': 'Nta birori biri imbere',
  'No events match': 'Nta birori bihuye n’ibyo ushakisha',
  'Check back when an event goes live, or browse upcoming events.': 'Ongera urebe igikorwa nigitangira live, cyangwa ushakishe ibiri imbere.',
  'Try a different filter or clear your search.': 'Gerageza guhindura akayunguruzo cyangwa usibe ibyo wanditse.',
  'LIVE ended': 'LIVE yarangiye',
  'Your broadcast has ended.': 'Imbonankubone yawe yarangiye.',
  'Start a new broadcast': 'Tangira imbonankubone nshya',
  'Start a new broadcast?': 'Gutangira imbonankubone nshya?',
  'Peak viewers': 'Abarebye benshi icyarimwe',
  'Duration': 'Igihe byamaze',
  'Comments': 'Ibitekerezo',
  'LIVE TITLE': 'UMUTWE WA LIVE',
  'GO LIVE': 'TANGIRA LIVE',
  'Preparing your LIVE…': 'Gutegura LIVE yawe…',
  'Connecting…': 'Birimo guhuza…',
  'Camera ready': 'Kamera iriteguye',
  'Starting camera…': 'Gutangiza kamera…',
  'Ready for OBS': 'Yiteguye OBS',
  'Mic off': 'Mikoro ifunze',
  'Mic on': 'Mikoro ifunguye',
  'Video off': 'Videwo ifunze',
  'Video on': 'Videwo ifunguye',
  'Front': 'Imbere',
  'This phone': 'Iyi telefoni',
  'External / OBS': 'Hanze / OBS',
  'Access code': 'Kode yo kwinjira',
  'Share link': 'Sangiza link',
  'Camera unavailable': 'Kamera ntibonetse',
  'Open Settings': 'Fungura Igenamiterere',
  'Stream paused': 'Live yahagaze gato',
  'Viewers are waiting. Resume when you are ready.': 'Abareba barategereje. Ongera ukomeze numara kwitegura.',
  'Resume': 'Komeza',
  'Performance': 'Imikorere',
  'Recent payments': 'Ubwishyu buheruka',
  'Quick actions': 'Ibikorwa byihuse',
  'YOUR DASHBOARD': 'IMBONERAHAMWE YAWE',
  'Earnings': 'Inyungu',
  'Spending': 'Ibyasohotse',
  'Balance': 'Amafaranga ariho',
  'Total earned': 'Amafaranga yose yinjijwe',
  'Total spent': 'Amafaranga yose yakoreshejwe',
  'In escrow': 'Ari mu bubiko bwizewe (Escrow)',
  'Released': 'Yarekuwe',
  'Refunded': 'Yasubijwe',
  'Payment accounts': 'Konti zo kwishyurirwaho',
  'Mobile Money': 'Mobile Money',
  'Bank': 'Banki',
  'Bank transfer': 'Kohereza kuri banki',
  'Card': 'Ikarita',
  'Donate': 'Tanga inkunga',
  'Collaborate': 'Gufatanya',
  'Opportunities': 'Amahirwe y’akazi',
  'Post My Event': 'Tangaza igikorwa cyanjye',
  'Post Your Event': 'Tangaza igikorwa cyawe',
  'Browse Photographers': 'Shakisha abafotozi',
  'Find a Photographer': 'Shaka Gafotozi',
  'New version available': 'Hari verisiyo nshya iboneka',
  'Update Connekyt to enjoy the latest improvements and features.': 'Vugurura Connekyt kugira ngo ukoreshe ibyiza n’udushya tugezweho.',
};

const WORD_REPLACEMENTS: [RegExp, string][] = [
  [/\bWelcome back\b/gi, 'Murakaza neza nanone'],
  [/\bSign in\b/gi, 'Injira'],
  [/\bSign up\b/gi, 'Iyandikishe'],
  [/\bLog in\b/gi, 'Injira'],
  [/\bSign out\b/gi, 'Sohoka'],
  [/\bCreate account\b/gi, 'Fungura konti'],
  [/\bPhotographers\b/gi, 'Abafotozi'],
  [/\bPhotographer\b/gi, 'Gafotozi'],
  [/\bClients\b/gi, 'Abakiriya'],
  [/\bClient\b/gi, 'Umukiriya'],
  [/\bCoordinators\b/gi, 'Abahuzabikorwa'],
  [/\bCoordinator\b/gi, 'Umuhuzabikorwa'],
  [/\bEvents\b/gi, 'Ibirori'],
  [/\bEvent\b/gi, 'Igikorwa'],
  [/\bBookings\b/gi, 'Imyanya yafashwe'],
  [/\bBooking\b/gi, 'Gufata umwanya'],
  [/\bPayment(s)?\b/gi, 'Ubwishyu'],
  [/\bWithdrawal(s)?\b/gi, 'Kubikuza'],
  [/\bWithdraw\b/gi, 'Bikuza'],
  [/\bWallet\b/gi, 'Ikofi'],
  [/\bBalance\b/gi, 'Amafaranga ariho'],
  [/\bAvailable\b/gi, 'Aboneka'],
  [/\bPending\b/gi, 'Bitegereje'],
  [/\bCompleted\b/gi, 'Byakozwe'],
  [/\bConfirmed\b/gi, 'Byemejwe'],
  [/\bCancelled\b/gi, 'Byahagaritswe'],
  [/\bFailed\b/gi, 'Byanze'],
  [/\bPhoto(s)?\b/gi, 'Amafoto'],
  [/\bAlbum(s)?\b/gi, 'Alubumu'],
  [/\bPhotobooks\b/gi, 'Ibitabo by’amafoto'],
  [/\bPhotobook\b/gi, 'Igitabo cy’amafoto'],
  [/\bGallery\b/gi, 'Ububiko bw’amafoto'],
  [/\bPackages\b/gi, 'Amapaki'],
  [/\bPackage\b/gi, 'Ipaki'],
  [/\bLive stream(s)?\b/gi, 'Imbonankubone'],
  [/\bLocation(s)?\b/gi, 'Ahantu'],
  [/\bCategory\b/gi, 'Icyiciro'],
  [/\bCategories\b/gi, 'Ibyiciro'],
  [/\bDate\b/gi, 'Itariki'],
  [/\bTime\b/gi, 'Isaha'],
  [/\bPrice\b/gi, 'Igiciro'],
  [/\bTotal\b/gi, 'Igiteranyo'],
  [/\bCancel\b/gi, 'Hagarika'],
  [/\bConfirm\b/gi, 'Emeza'],
  [/\bContinue\b/gi, 'Komeza'],
  [/\bSave\b/gi, 'Bika'],
  [/\bClose\b/gi, 'Funga'],
  [/\bBack\b/gi, 'Subira inyuma'],
  [/\bRetry\b/gi, 'Ongera ugerageze'],
  [/\bTry again\b/gi, 'Ongera ugerageze'],
  [/\bLoading\b/gi, 'Birimo gufunguka'],
  [/\bSearch\b/gi, 'Shakisha'],
  [/\bSettings\b/gi, 'Igenamiterere'],
  [/\bProfile\b/gi, 'Umwirondoro'],
  [/\bAccount(s)?\b/gi, 'Konti'],
  [/\bMessage(s)?\b/gi, 'Ubutumwa'],
  [/\bNotification(s)?\b/gi, 'Imenyesha'],
  [/\bVerify\b/gi, 'Emeza'],
  [/\bVerification\b/gi, 'Kwemeza'],
];

/**
 * Translates any English string into Kinyarwanda while preserving `{param}` placeholders.
 */
export function toKinyarwanda(text: string): string {
  if (!text) return '';
  const exact = SHARED_RW_EXACT[text] ?? SHARED_RW_EXACT[text.trim()];
  if (exact) return exact;

  // Protect `{placeholder}` tokens during phrase replacement
  const tokens: string[] = [];
  let working = text.replace(/\{[^}]+\}/g, (match) => {
    tokens.push(match);
    return `__TK_${tokens.length - 1}__`;
  });

  for (const [regex, replacement] of WORD_REPLACEMENTS) {
    working = working.replace(regex, replacement as string);
  }

  return working.replace(/__TK_(\d+)__/g, (_, idx) => tokens[Number(idx)] ?? '');
}

/**
 * Dynamic & exact Kinyarwanda translator for `translateShared(text, 'rw')`.
 */
export function translateSharedRw(text: string): string {
  if (!text) return '';
  const exact = SHARED_RW_EXACT[text] ?? SHARED_RW_EXACT[text.trim()];
  if (exact) return exact;

  const trimmed = text.trim();

  const inDays = /^In (\d+) days$/i.exec(trimmed);
  if (inDays) return `Mu minsi ${inDays[1]}`;

  const startsInH = /^Starts in (\d+)h$/i.exec(trimmed);
  if (startsInH) return `Bitangira mu masaha ${startsInH[1]}`;

  const overdueBy = /^Overdue by (\d+)d$/i.exec(trimmed);
  if (overdueBy) return `Byakererewe ho iminsi ${overdueBy[1]}`;

  const dueIn = /^Due in (\d+)d$/i.exec(trimmed);
  if (dueIn) return `Bitegerejwe mu minsi ${dueIn[1]}`;

  const everyUnit = /^Every (day|week|month|year)$/i.exec(trimmed);
  if (everyUnit) {
    const unit = everyUnit[1].toLowerCase();
    const rwMap: Record<string, string> = {
      day: 'Buri munsi',
      week: 'Buri cyumweru',
      month: 'Buri kwezi',
      year: 'Buri mwaka',
    };
    return rwMap[unit] ?? text;
  }

  const everyNUnits = /^Every (\d+) (day|week|month|year)s$/i.exec(trimmed);
  if (everyNUnits) {
    const n = everyNUnits[1];
    const unit = everyNUnits[2].toLowerCase();
    const rwUnits: Record<string, string> = {
      day: 'iminsi',
      week: 'ibyumweru',
      month: 'amezi',
      year: 'imyaka',
    };
    return `Buri ${rwUnits[unit]} ${n}`;
  }

  const photosCount = /^(\d+) photos?$/i.exec(trimmed);
  if (photosCount) {
    const n = Number(photosCount[1]);
    return `${n === 1 ? 'Ifoto' : 'Amafoto'} ${n}`;
  }

  const eventsCount = /^(\d+) events?$/i.exec(trimmed);
  if (eventsCount) {
    const n = Number(eventsCount[1]);
    return `${n === 1 ? 'Igikorwa' : 'Ibirori'} ${n}`;
  }

  const filtersActive = /^(\d+) filters? active$/i.exec(trimmed);
  if (filtersActive) {
    return `Utuyunguruzo ${filtersActive[1]} turakora`;
  }

  const eventsStatus = /^(\d+) events? (live now|coming up|recently ended|available)$/i.exec(trimmed);
  if (eventsStatus) {
    const n = eventsStatus[1];
    const st = eventsStatus[2].toLowerCase();
    const suffix: Record<string, string> = {
      'live now': 'biri live ubu',
      'coming up': 'biri imbere',
      'recently ended': 'biheruka kurangira',
      available: 'biboneka',
    };
    return `Ibirori ${n} ${suffix[st] ?? ''}`.trim();
  }

  const byAuthor = /^By (.+)$/.exec(trimmed);
  if (byAuthor) return `Byakozwe na ${byAuthor[1]}`;

  const paymentsWaiting = /^(\d+) payments? waiting$/i.exec(trimmed);
  if (paymentsWaiting) return `Ubwishyu ${paymentsWaiting[1]} butegereje`;

  const bookingsWaitingPayment = /^(\d+) bookings? waiting for payment$/i.exec(trimmed);
  if (bookingsWaitingPayment) return `Imyanya ${bookingsWaitingPayment[1]} itegereje kwishyurwa`;

  const requestsWaiting = /^(\d+) booking requests? waiting$/i.exec(trimmed);
  if (requestsWaiting) return `Ubusabe ${requestsWaiting[1]} butegereje`;

  const noChangeVs = /^No change vs (yesterday|last week|last month)$/i.exec(trimmed);
  if (noChangeVs) {
    const p = noChangeVs[1].toLowerCase();
    const rwP: Record<string, string> = {
      yesterday: 'ejo hashize',
      'last week': 'icyumweru gishize',
      'last month': 'ukwezi gushize',
    };
    return `Nta mpinduka ugereranyije na ${rwP[p]}`;
  }

  const trendVs = /^(Up|Down) (.+) vs (yesterday|last week|last month)$/i.exec(trimmed);
  if (trendVs) {
    const dir = trendVs[1].toLowerCase();
    const pct = trendVs[2];
    const p = trendVs[3].toLowerCase();
    const rwP: Record<string, string> = {
      yesterday: 'ejo hashize',
      'last week': 'icyumweru gishize',
      'last month': 'ukwezi gushize',
    };
    return `${dir === 'down' ? 'Byagabanutseho' : 'Byazamutseho'} ${pct} vs ${rwP[p]}`;
  }

  return toKinyarwanda(text);
}

/**
 * Builds a complete Kinyarwanda dictionary for any English key-value map.
 */
export function buildKinyarwandaDict<T extends Record<string, any>>(
  enDict: T,
  overrides: Partial<Record<keyof T, any>> = {},
): T {
  const result = {} as Record<keyof T, any>;
  for (const key of Object.keys(enDict) as (keyof T)[]) {
    const custom = overrides[key] ?? CORE_RW[key as string];
    if (custom !== undefined) {
      result[key] = custom;
    } else if (typeof enDict[key] === 'string') {
      result[key] = toKinyarwanda(enDict[key]);
    } else {
      result[key] = enDict[key];
    }
  }
  return result as T;
}

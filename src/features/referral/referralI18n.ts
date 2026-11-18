/**
 * Referral program strings in en, sw, rw, fr, es. Drafted translations, to be reviewed by a native speaker.
 * Generated from one source so the web, dashboard and app say the same thing.
 */
export type ReferralStrings = typeof EN;
const EN = {
  "field": {
    "label": "Referral code or link (optional)",
    "placeholder": "e.g. ABCD2345",
    "checking": "Checking…",
    "applied": "Code applied: referred by {name}",
    "invalid": "This code isn't valid",
    "limit": "This referrer has reached their limit",
    "notEligible": "This referrer can't take new referrals right now",
    "self": "You can't use your own code",
    "mutual": "This code can't be used",
    "already": "Your account already has a referrer",
    "tooMany": "Too many attempts. Please wait a minute.",
    "error": "Couldn't check the code. You can continue without it.",
    "remove": "Remove",
    "policy": "How the referral program works"
  },
  "ui": {
    "menuAlbum": "Share your album",
    "menuProfile": "Share profile",
    "menuReferral": "Share referral link or code",
    "shareTitle": "Share",
    "sheetTitle": "Referral program",
    "yourCode": "Your code",
    "yourLink": "Your link",
    "copy": "Copy",
    "copied": "Copied",
    "whatsapp": "WhatsApp",
    "moreApps": "More apps",
    "saveQr": "Save QR",
    "progressToUnlock": "{n} of 5 to unlock 25%",
    "yourFee": "Your fee: {fee}% · {n} of 20 referrals",
    "complete": "Program complete: 20/20 · your fee: 10%",
    "referralsTitle": "Your referrals",
    "statusPending": "Pending",
    "statusUnderReview": "Under review",
    "statusQualified": "Qualified",
    "statusRevoked": "Revoked",
    "emptyTitle": "No referrals yet",
    "emptyBody": "Share your code. A referral counts when the photographer you refer is approved and completes a paid job.",
    "loadError": "Couldn't load your referrals",
    "retry": "Retry",
    "addCode": "Add a referral code",
    "addCodeHelp": "Enter the code or link of the photographer who referred you.",
    "confirmTitle": "Confirm your referrer",
    "referredBy": "Referred by {name}",
    "confirmWarning": "This can't be changed later.",
    "confirm": "Confirm",
    "cancel": "Cancel",
    "saved": "Referral code saved",
    "shareMessage": "Join me on Connekyt. Use my referral code {code}: {link}",
    "cardTitle": "Share & invite",
    "chipAlbum": "Album",
    "chipProfile": "Profile",
    "chipReferral": "Referral",
    "badgeLower": "Lower fees",
    "badgeFee": "Your fee: {fee}%",
    "subAlbum": "Send an album link to your clients",
    "subReferral": "Invite photographers, lower your fee"
  },
  "policy": {
    "title": "Connekyt Photographer Referral Program",
    "updated": "Last updated: November 2026",
    "intro": "Refer other photographers to Connekyt and lower your platform fee as they start earning.",
    "tableTitle": "Fee table",
    "colRefs": "Qualifying referrals",
    "colFee": "Your platform fee",
    "rowDefault": "0 to 4",
    "rowDefaultFee": "Your normal fee",
    "rowFive": "5",
    "rowStep": "6 to 19",
    "rowStepFee": "30% minus 1 point per referral (24% at 6, down to 11% at 19)",
    "rowMax": "20 (maximum)",
    "sections": [
      {
        "h": "Who can join",
        "p": [
          "The program is open to Connekyt photographers whose profile is accepted and active. Each eligible photographer gets one unique 8-character code and a link: connekyt.com/join?ref=YOURCODE."
        ]
      },
      {
        "h": "How to refer",
        "p": [
          "Share your code or link from the Share menu on your Home screen. A new photographer can enter it when they sign up (it is optional). An existing photographer who has no referrer yet can add a code in Profile, Settings, Add a referral code."
        ]
      },
      {
        "h": "New and existing photographers",
        "p": [
          "Each account can have one referrer. It is set once and can never be changed. You cannot refer yourself, and two photographers cannot refer each other."
        ]
      },
      {
        "h": "When a referral counts",
        "p": [
          "A referral is qualified when the referred photographer is accepted and completes a paid job (a booking, a photo or album sale, a livestream ticket or a gift) that settles after the referral was attached, from a real client, of at least USD 5. For existing photographers, payments from before the code was added never count.",
          "Until then the referral is pending. A payment that is refunded or charged back never qualifies, and the referral goes back to pending."
        ]
      },
      {
        "h": "Your fee",
        "p": [
          "Your platform fee depends on your qualifying referrals, as in the table above. It applies to your bookings, photo and album sales, livestream tickets and gifts. If one of your fees is already lower than the program rate, you keep the lower one."
        ]
      },
      {
        "h": "The 20-referral limit",
        "p": [
          "The maximum is 20 qualifying referrals, which gives the lowest fee of 10%. When you reach it, your code stops accepting new referrals."
        ]
      },
      {
        "h": "Permanent and not retroactive",
        "p": [
          "A rate you have earned does not go back up, even if a referred photographer leaves later. The new rate applies to transactions from the moment a referral qualifies and never changes past transactions. The only exception is a referral that Connekyt revokes as fraudulent."
        ]
      },
      {
        "h": "Fraud checks and review",
        "p": [
          "We check every referral for self-referral, shared phone numbers, emails, payout accounts, devices or ID details, payments made by the same client to both of you, unusual bursts of sign-ups and circular referrals. A suspicious referral is held under review and does not count until our team clears it. When we revoke a referral, your rate is recalculated from that moment on, not backwards."
        ]
      },
      {
        "h": "Changes to the program",
        "p": [
          "Connekyt may change or end the program for future referrals. Rates you have already earned are kept."
        ]
      },
      {
        "h": "Contact",
        "p": [
          "Questions about the program: info@connekyt.com."
        ]
      }
    ]
  }
} as const;
export const REFERRAL_I18N: Record<string, ReferralStrings> = {
  en: EN,
  sw: {
    "field": {
      "label": "Msimbo au kiungo cha rufaa (si lazima)",
      "placeholder": "mf. ABCD2345",
      "checking": "Inakagua…",
      "applied": "Msimbo umetumika: umealikwa na {name}",
      "invalid": "Msimbo huu si sahihi",
      "limit": "Mwalikaji huyu amefikia kikomo chake",
      "notEligible": "Mwalikaji huyu hawezi kupokea rufaa mpya kwa sasa",
      "self": "Huwezi kutumia msimbo wako mwenyewe",
      "mutual": "Msimbo huu hauwezi kutumika",
      "already": "Akaunti yako tayari ina mwalikaji",
      "tooMany": "Majaribio mengi sana. Tafadhali subiri dakika moja.",
      "error": "Imeshindwa kukagua msimbo. Unaweza kuendelea bila huo.",
      "remove": "Ondoa",
      "policy": "Jinsi mpango wa rufaa unavyofanya kazi"
    },
    "ui": {
      "menuAlbum": "Shiriki albamu yako",
      "menuProfile": "Shiriki wasifu",
      "menuReferral": "Shiriki kiungo au msimbo wa rufaa",
      "shareTitle": "Shiriki",
      "sheetTitle": "Mpango wa rufaa",
      "yourCode": "Msimbo wako",
      "yourLink": "Kiungo chako",
      "copy": "Nakili",
      "copied": "Imenakiliwa",
      "whatsapp": "WhatsApp",
      "moreApps": "Programu zaidi",
      "saveQr": "Hifadhi QR",
      "progressToUnlock": "{n} kati ya 5 ili kufungua 25%",
      "yourFee": "Ada yako: {fee}% · rufaa {n} kati ya 20",
      "complete": "Mpango umekamilika: 20/20 · ada yako: 10%",
      "referralsTitle": "Rufaa zako",
      "statusPending": "Inasubiri",
      "statusUnderReview": "Inakaguliwa",
      "statusQualified": "Imestahili",
      "statusRevoked": "Imefutwa",
      "emptyTitle": "Bado hakuna rufaa",
      "emptyBody": "Shiriki msimbo wako. Rufaa huhesabiwa mpigapicha uliyemwalika akikubaliwa na kukamilisha kazi iliyolipwa.",
      "loadError": "Imeshindwa kupakia rufaa zako",
      "retry": "Jaribu tena",
      "addCode": "Ongeza msimbo wa rufaa",
      "addCodeHelp": "Weka msimbo au kiungo cha mpigapicha aliyekualika.",
      "confirmTitle": "Thibitisha mwalikaji wako",
      "referredBy": "Umealikwa na {name}",
      "confirmWarning": "Hili haliwezi kubadilishwa baadaye.",
      "confirm": "Thibitisha",
      "cancel": "Ghairi",
      "saved": "Msimbo wa rufaa umehifadhiwa",
      "shareMessage": "Jiunge nami kwenye Connekyt. Tumia msimbo wangu wa rufaa {code}: {link}",
      "cardTitle": "Shiriki na ualike",
      "chipAlbum": "Albamu",
      "chipProfile": "Wasifu",
      "chipReferral": "Rufaa",
      "badgeLower": "Ada ndogo",
      "badgeFee": "Ada yako: {fee}%",
      "subAlbum": "Tuma kiungo cha albamu kwa wateja wako",
      "subReferral": "Alika wapigapicha, punguza ada yako"
    },
    "policy": {
      "title": "Mpango wa Rufaa wa Wapigapicha wa Connekyt",
      "updated": "Imesasishwa: Novemba 2026",
      "intro": "Alika wapigapicha wengine kwenye Connekyt na upunguze ada yako ya jukwaa wanapoanza kupata mapato.",
      "tableTitle": "Jedwali la ada",
      "colRefs": "Rufaa zinazostahili",
      "colFee": "Ada yako ya jukwaa",
      "rowDefault": "0 hadi 4",
      "rowDefaultFee": "Ada yako ya kawaida",
      "rowFive": "5",
      "rowStep": "6 hadi 19",
      "rowStepFee": "30% toa pointi 1 kwa kila rufaa (24% kwa 6, hadi 11% kwa 19)",
      "rowMax": "20 (kiwango cha juu)",
      "sections": [
        {
          "h": "Nani anaweza kujiunga",
          "p": [
            "Mpango huu uko wazi kwa wapigapicha wa Connekyt ambao wasifu wao umekubaliwa na unatumika. Kila mpigapicha anayestahili anapata msimbo mmoja wa kipekee wa herufi 8 na kiungo: connekyt.com/join?ref=MSIMBOWAKO."
          ]
        },
        {
          "h": "Jinsi ya kualika",
          "p": [
            "Shiriki msimbo au kiungo chako kupitia menyu ya Shiriki kwenye skrini yako ya Nyumbani. Mpigapicha mpya anaweza kuuweka anapojisajili (si lazima). Mpigapicha aliyepo ambaye hana mwalikaji bado anaweza kuongeza msimbo kwenye Wasifu, Mipangilio, Ongeza msimbo wa rufaa."
          ]
        },
        {
          "h": "Wapigapicha wapya na waliopo",
          "p": [
            "Kila akaunti inaweza kuwa na mwalikaji mmoja. Huwekwa mara moja na hauwezi kubadilishwa kamwe. Huwezi kujialika mwenyewe, na wapigapicha wawili hawawezi kualikana."
          ]
        },
        {
          "h": "Rufaa inapohesabiwa",
          "p": [
            "Rufaa inastahili pale mpigapicha aliyealikwa anapokubaliwa na kukamilisha kazi iliyolipwa (uhifadhi, mauzo ya picha au albamu, tiketi ya matangazo ya moja kwa moja au zawadi) ambayo inakamilika baada ya rufaa kuwekwa, kutoka kwa mteja halisi, yenye angalau USD 5. Kwa wapigapicha waliopo, malipo ya kabla ya msimbo kuongezwa hayahesabiwi kamwe.",
            "Hadi hapo rufaa inasubiri. Malipo yaliyorejeshwa au kupingwa hayastahili kamwe, na rufaa hurudi kusubiri."
          ]
        },
        {
          "h": "Ada yako",
          "p": [
            "Ada yako ya jukwaa inategemea rufaa zako zinazostahili, kama kwenye jedwali hapo juu. Inatumika kwa uhifadhi, mauzo ya picha na albamu, tiketi za matangazo ya moja kwa moja na zawadi. Ikiwa ada yako yoyote tayari iko chini ya kiwango cha mpango, unabaki na ya chini zaidi."
          ]
        },
        {
          "h": "Kikomo cha rufaa 20",
          "p": [
            "Kiwango cha juu ni rufaa 20 zinazostahili, ambazo hutoa ada ya chini kabisa ya 10%. Ukifikia kikomo, msimbo wako huacha kupokea rufaa mpya."
          ]
        },
        {
          "h": "Ya kudumu na si ya nyuma",
          "p": [
            "Kiwango ulichopata hakipandi tena, hata kama mpigapicha aliyealikwa ataondoka baadaye. Kiwango kipya kinatumika kwa miamala kuanzia wakati rufaa inapostahili na hakibadilishi miamala ya zamani. Isipokuwa pekee ni rufaa ambayo Connekyt inaifuta kwa udanganyifu."
          ]
        },
        {
          "h": "Ukaguzi wa udanganyifu na mapitio",
          "p": [
            "Tunakagua kila rufaa kwa kujialika, namba za simu, barua pepe, akaunti za malipo, vifaa au taarifa za kitambulisho zinazofanana, malipo ya mteja yule yule kwa nyote wawili, mlipuko usio wa kawaida wa usajili na rufaa za mzunguko. Rufaa yenye mashaka husubiri mapitio na haihesabiwi hadi timu yetu iidhinishe. Tunapofuta rufaa, kiwango chako kinahesabiwa upya kuanzia wakati huo, si nyuma."
          ]
        },
        {
          "h": "Mabadiliko ya mpango",
          "p": [
            "Connekyt inaweza kubadilisha au kusitisha mpango kwa rufaa za baadaye. Viwango ulivyokwisha pata vinabaki."
          ]
        },
        {
          "h": "Mawasiliano",
          "p": [
            "Maswali kuhusu mpango: info@connekyt.com."
          ]
        }
      ]
    }
  } as unknown as ReferralStrings,
  rw: {
    "field": {
      "label": "Kode cyangwa link y’umutumirizi (si itegeko)",
      "placeholder": "urugero ABCD2345",
      "checking": "Iri gusuzuma…",
      "applied": "Kode yemewe: watumiwe na {name}",
      "invalid": "Iyi kode ntiyemewe",
      "limit": "Uyu mutumirizi yagejeje ku mubare ntarengwa",
      "notEligible": "Uyu mutumirizi ntashobora kwakira abatumirwa bashya ubu",
      "self": "Ntushobora gukoresha kode yawe bwite",
      "mutual": "Iyi kode ntishobora gukoreshwa",
      "already": "Konti yawe isanzwe ifite umutumirizi",
      "tooMany": "Wagerageje inshuro nyinshi. Tegereza umunota umwe.",
      "error": "Ntibyashobotse gusuzuma kode. Ushobora gukomeza utayifite.",
      "remove": "Kuraho",
      "policy": "Uko gahunda yo gutumira ikora"
    },
    "ui": {
      "menuAlbum": "Sangiza alubumu yawe",
      "menuProfile": "Sangiza profili",
      "menuReferral": "Sangiza link cyangwa kode yo gutumira",
      "shareTitle": "Sangiza",
      "sheetTitle": "Gahunda yo gutumira",
      "yourCode": "Kode yawe",
      "yourLink": "Link yawe",
      "copy": "Kopera",
      "copied": "Byakoporowe",
      "whatsapp": "WhatsApp",
      "moreApps": "Izindi porogaramu",
      "saveQr": "Bika QR",
      "progressToUnlock": "{n} kuri 5 kugira ngo ufungure 25%",
      "yourFee": "Igiciro cyawe: {fee}% · abatumiwe {n} kuri 20",
      "complete": "Gahunda yuzuye: 20/20 · igiciro cyawe: 10%",
      "referralsTitle": "Abo watumiye",
      "statusPending": "Bategereje",
      "statusUnderReview": "Barasuzumwa",
      "statusQualified": "Byemejwe",
      "statusRevoked": "Byakuweho",
      "emptyTitle": "Nta batumiwe baraboneka",
      "emptyBody": "Sangiza kode yawe. Uwatumiwe abarwa iyo yemewe kandi akarangiza akazi kishyuwe.",
      "loadError": "Ntibyashobotse gutangaza abo watumiye",
      "retry": "Ongera ugerageze",
      "addCode": "Ongeraho kode yo gutumira",
      "addCodeHelp": "Andika kode cyangwa link y’umufotozi wagutumiye.",
      "confirmTitle": "Emeza uwagutumiye",
      "referredBy": "Watumiwe na {name}",
      "confirmWarning": "Ibi ntibishobora guhindurwa nyuma.",
      "confirm": "Emeza",
      "cancel": "Reka",
      "saved": "Kode yo gutumira yabitswe",
      "shareMessage": "Twifatanye kuri Connekyt. Koresha kode yanjye {code}: {link}",
      "cardTitle": "Sangiza no gutumira",
      "chipAlbum": "Alubumu",
      "chipProfile": "Profili",
      "chipReferral": "Gutumira",
      "badgeLower": "Igiciro gito",
      "badgeFee": "Igiciro cyawe: {fee}%",
      "subAlbum": "Ohereza link ya alubumu ku bakiriya bawe",
      "subReferral": "Tumira abafotozi, ugabanye igiciro"
    },
    "policy": {
      "title": "Gahunda ya Connekyt yo Gutumira Abafotozi",
      "updated": "Yavuguruwe: Ugushyingo 2026",
      "intro": "Tumira abandi bafotozi kuri Connekyt maze igiciro cya platform ugabanuke uko batangira kwinjiza.",
      "tableTitle": "Imbonerahamwe y’ibiciro",
      "colRefs": "Abatumiwe bemewe",
      "colFee": "Igiciro cyawe cya platform",
      "rowDefault": "0 kugeza kuri 4",
      "rowDefaultFee": "Igiciro cyawe gisanzwe",
      "rowFive": "5",
      "rowStep": "6 kugeza kuri 19",
      "rowStepFee": "30% ukuyemo 1 kuri buri mutumirwa (24% kuri 6, kugeza kuri 11% kuri 19)",
      "rowMax": "20 (ntarengwa)",
      "sections": [
        {
          "h": "Ushobora kujyamo",
          "p": [
            "Gahunda ifunguriwe abafotozi ba Connekyt bafite profili yemewe kandi ikora. Buri mufotozi wujuje ibisabwa ahabwa kode imwe yihariye y’inyuguti 8 na link: connekyt.com/join?ref=KODEYAWE."
          ]
        },
        {
          "h": "Uko utumira",
          "p": [
            "Sangiza kode cyangwa link yawe ukoresheje menu ya Sangiza ku rupapuro rwawe rw’Ahabanza. Umufotozi mushya ayishyiramo yiyandikisha (si itegeko). Umufotozi usanzwe utaragira umutumirizi ashobora kongeraho kode muri Profili, Igenamiterere, Ongeraho kode yo gutumira."
          ]
        },
        {
          "h": "Abafotozi bashya n’abasanzwe",
          "p": [
            "Buri konti igira umutumirizi umwe. Ashyirwaho rimwe kandi ntahinduka. Ntushobora kwitumira, kandi abafotozi babiri ntibashobora gutumirana."
          ]
        },
        {
          "h": "Igihe utumira abarwa",
          "p": [
            "Uwatumiwe abarwa iyo umufotozi yemewe kandi akarangiza akazi kishyuwe (gufata serivisi, kugurisha amafoto cyangwa alubumu, itike yo kureba live cyangwa impano) kirangira nyuma yo gushyirwaho kw’utumira, kuva ku mukiriya nyakuri, kari nibura USD 5. Ku bafotozi basanzwe, ubwishyu bwabanje kode itarongerwaho ntibubarwa.",
            "Kugeza ubwo, utumira ategereje. Ubwishyu bwasubijwe cyangwa bwatewe utwatsi ntibubarwa, kandi utumira asubira mu gutegereza."
          ]
        },
        {
          "h": "Igiciro cyawe",
          "p": [
            "Igiciro cyawe cya platform giterwa n’abatumiwe bemewe, nk’uko imbonerahamwe iri hejuru ibigaragaza. Gikoreshwa kuri serivisi, kugurisha amafoto na alubumu, amatike ya live n’impano. Niba igiciro cyawe icyo ari cyo cyose kiri munsi y’icya gahunda, ugumana icyo hasi."
          ]
        },
        {
          "h": "Umubare ntarengwa w’abatumiwe 20",
          "p": [
            "Umubare ntarengwa ni abatumiwe 20 bemewe, butanga igiciro gito cya 10%. Iyo ugeze kuri wo, kode yawe ireka kwakira abatumiwe bashya."
          ]
        },
        {
          "h": "Burundu kandi ntisubira inyuma",
          "p": [
            "Igiciro wabonye ntigisubira hejuru, nubwo uwatumiwe yagenda nyuma. Igiciro gishya gikoreshwa ku bikorwa bishya uhereye igihe uwatumiwe yemerewe kandi ntigihindura ibyabaye. Icyihariye ni uwatumiwe Connekyt ikuyeho kubera uburiganya."
          ]
        },
        {
          "h": "Gusuzuma uburiganya",
          "p": [
            "Dusuzuma buri mutumirwa ku kwitumira, nimero za telefoni, imeri, konti zo kwishyurwa, ibikoresho cyangwa amakuru y’indangamuntu bihuye, ubwishyu bw’umukiriya umwe kuri mwembi, kwiyandikisha gutunguranye ari benshi n’abatumirana mu cyiciro. Utumirwa ukekwa ategereza isuzuma kandi ntabarwa kugeza itsinda ryacu rimwemeje. Iyo dukuyeho utumirwa, igiciro cyawe kibarwa bundi bushya uhereye icyo gihe, si inyuma."
          ]
        },
        {
          "h": "Impinduka kuri gahunda",
          "p": [
            "Connekyt ishobora guhindura cyangwa guhagarika gahunda ku batumirwa bazaza. Ibiciro wamaze kubona biguma."
          ]
        },
        {
          "h": "Twandikire",
          "p": [
            "Ibibazo kuri gahunda: info@connekyt.com."
          ]
        }
      ]
    }
  } as unknown as ReferralStrings,
  fr: {
    "field": {
      "label": "Code ou lien de parrainage (facultatif)",
      "placeholder": "ex. ABCD2345",
      "checking": "Vérification…",
      "applied": "Code appliqué : parrainé par {name}",
      "invalid": "Ce code n'est pas valide",
      "limit": "Ce parrain a atteint sa limite",
      "notEligible": "Ce parrain ne peut pas accepter de nouveaux filleuls pour le moment",
      "self": "Vous ne pouvez pas utiliser votre propre code",
      "mutual": "Ce code ne peut pas être utilisé",
      "already": "Votre compte a déjà un parrain",
      "tooMany": "Trop de tentatives. Veuillez patienter une minute.",
      "error": "Impossible de vérifier le code. Vous pouvez continuer sans.",
      "remove": "Retirer",
      "policy": "Comment fonctionne le programme de parrainage"
    },
    "ui": {
      "menuAlbum": "Partager votre album",
      "menuProfile": "Partager le profil",
      "menuReferral": "Partager le lien ou code de parrainage",
      "shareTitle": "Partager",
      "sheetTitle": "Programme de parrainage",
      "yourCode": "Votre code",
      "yourLink": "Votre lien",
      "copy": "Copier",
      "copied": "Copié",
      "whatsapp": "WhatsApp",
      "moreApps": "Plus d'applis",
      "saveQr": "Enregistrer le QR",
      "progressToUnlock": "{n} sur 5 pour débloquer 25 %",
      "yourFee": "Vos frais : {fee} % · {n} filleuls sur 20",
      "complete": "Programme terminé : 20/20 · vos frais : 10 %",
      "referralsTitle": "Vos filleuls",
      "statusPending": "En attente",
      "statusUnderReview": "En vérification",
      "statusQualified": "Qualifié",
      "statusRevoked": "Révoqué",
      "emptyTitle": "Aucun filleul pour le moment",
      "emptyBody": "Partagez votre code. Un parrainage compte quand le photographe parrainé est approuvé et termine une mission payée.",
      "loadError": "Impossible de charger vos filleuls",
      "retry": "Réessayer",
      "addCode": "Ajouter un code de parrainage",
      "addCodeHelp": "Saisissez le code ou le lien du photographe qui vous a parrainé.",
      "confirmTitle": "Confirmez votre parrain",
      "referredBy": "Parrainé par {name}",
      "confirmWarning": "Ceci ne pourra plus être modifié.",
      "confirm": "Confirmer",
      "cancel": "Annuler",
      "saved": "Code de parrainage enregistré",
      "shareMessage": "Rejoignez-moi sur Connekyt. Utilisez mon code de parrainage {code} : {link}",
      "cardTitle": "Partager et inviter",
      "chipAlbum": "Album",
      "chipProfile": "Profil",
      "chipReferral": "Parrainage",
      "badgeLower": "Frais réduits",
      "badgeFee": "Vos frais : {fee} %",
      "subAlbum": "Envoyez un lien d’album à vos clients",
      "subReferral": "Invitez des photographes, baissez vos frais"
    },
    "policy": {
      "title": "Programme de parrainage des photographes Connekyt",
      "updated": "Dernière mise à jour : novembre 2026",
      "intro": "Parrainez d'autres photographes sur Connekyt et réduisez vos frais de plateforme à mesure qu'ils gagnent.",
      "tableTitle": "Barème des frais",
      "colRefs": "Parrainages qualifiés",
      "colFee": "Vos frais de plateforme",
      "rowDefault": "0 à 4",
      "rowDefaultFee": "Vos frais habituels",
      "rowFive": "5",
      "rowStep": "6 à 19",
      "rowStepFee": "30 % moins 1 point par parrainage (24 % à 6, jusqu’à 11 % à 19)",
      "rowMax": "20 (maximum)",
      "sections": [
        {
          "h": "Qui peut participer",
          "p": [
            "Le programme est ouvert aux photographes Connekyt dont le profil est accepté et actif. Chaque photographe éligible reçoit un code unique de 8 caractères et un lien : connekyt.com/join?ref=VOTRECODE."
          ]
        },
        {
          "h": "Comment parrainer",
          "p": [
            "Partagez votre code ou lien depuis le menu Partager de votre écran d'accueil. Un nouveau photographe peut le saisir à l'inscription (facultatif). Un photographe existant sans parrain peut ajouter un code dans Profil, Paramètres, Ajouter un code de parrainage."
          ]
        },
        {
          "h": "Photographes nouveaux et existants",
          "p": [
            "Chaque compte peut avoir un seul parrain. Il est défini une fois et ne peut jamais être modifié. Vous ne pouvez pas vous parrainer vous-même, et deux photographes ne peuvent pas se parrainer mutuellement."
          ]
        },
        {
          "h": "Quand un parrainage compte",
          "p": [
            "Un parrainage est qualifié lorsque le photographe parrainé est accepté et termine une mission payée (réservation, vente de photos ou d'album, billet de diffusion en direct ou cadeau) réglée après l'enregistrement du parrainage, par un vrai client, d'au moins 5 USD. Pour les photographes existants, les paiements antérieurs à l'ajout du code ne comptent jamais.",
            "D'ici là, le parrainage est en attente. Un paiement remboursé ou contesté ne qualifie jamais, et le parrainage repasse en attente."
          ]
        },
        {
          "h": "Vos frais",
          "p": [
            "Vos frais de plateforme dépendent de vos parrainages qualifiés, selon le barème ci-dessus. Ils s'appliquent à vos réservations, ventes de photos et d'albums, billets de direct et cadeaux. Si l'un de vos frais est déjà inférieur au taux du programme, vous gardez le plus bas."
          ]
        },
        {
          "h": "La limite de 20 parrainages",
          "p": [
            "Le maximum est de 20 parrainages qualifiés, ce qui donne les frais les plus bas, 10 %. Une fois atteint, votre code n'accepte plus de nouveaux parrainages."
          ]
        },
        {
          "h": "Permanent et non rétroactif",
          "p": [
            "Un taux obtenu ne remonte pas, même si un filleul quitte la plateforme. Le nouveau taux s'applique aux transactions à partir du moment où un parrainage est qualifié et ne modifie jamais les transactions passées. La seule exception est un parrainage que Connekyt révoque pour fraude."
          ]
        },
        {
          "h": "Contrôles anti-fraude et vérification",
          "p": [
            "Nous vérifions chaque parrainage : auto-parrainage, numéros de téléphone, e-mails, comptes de paiement, appareils ou pièces d'identité identiques, paiements du même client aux deux photographes, vagues d'inscriptions inhabituelles et parrainages circulaires. Un parrainage suspect est mis en vérification et ne compte pas tant que notre équipe ne l'a pas validé. Lorsqu'un parrainage est révoqué, votre taux est recalculé à partir de ce moment, pas rétroactivement."
          ]
        },
        {
          "h": "Modifications du programme",
          "p": [
            "Connekyt peut modifier ou arrêter le programme pour les futurs parrainages. Les taux déjà obtenus sont conservés."
          ]
        },
        {
          "h": "Contact",
          "p": [
            "Questions sur le programme : info@connekyt.com."
          ]
        }
      ]
    }
  } as unknown as ReferralStrings,
  es: {
    "field": {
      "label": "Código o enlace de referido (opcional)",
      "placeholder": "p. ej. ABCD2345",
      "checking": "Comprobando…",
      "applied": "Código aplicado: referido por {name}",
      "invalid": "Este código no es válido",
      "limit": "Este referidor alcanzó su límite",
      "notEligible": "Este referidor no puede aceptar nuevos referidos ahora",
      "self": "No puedes usar tu propio código",
      "mutual": "Este código no se puede usar",
      "already": "Tu cuenta ya tiene un referidor",
      "tooMany": "Demasiados intentos. Espera un minuto.",
      "error": "No se pudo comprobar el código. Puedes continuar sin él.",
      "remove": "Quitar",
      "policy": "Cómo funciona el programa de referidos"
    },
    "ui": {
      "menuAlbum": "Compartir tu álbum",
      "menuProfile": "Compartir perfil",
      "menuReferral": "Compartir enlace o código de referido",
      "shareTitle": "Compartir",
      "sheetTitle": "Programa de referidos",
      "yourCode": "Tu código",
      "yourLink": "Tu enlace",
      "copy": "Copiar",
      "copied": "Copiado",
      "whatsapp": "WhatsApp",
      "moreApps": "Más apps",
      "saveQr": "Guardar QR",
      "progressToUnlock": "{n} de 5 para desbloquear 25 %",
      "yourFee": "Tu comisión: {fee} % · {n} de 20 referidos",
      "complete": "Programa completo: 20/20 · tu comisión: 10 %",
      "referralsTitle": "Tus referidos",
      "statusPending": "Pendiente",
      "statusUnderReview": "En revisión",
      "statusQualified": "Calificado",
      "statusRevoked": "Revocado",
      "emptyTitle": "Aún no hay referidos",
      "emptyBody": "Comparte tu código. Un referido cuenta cuando el fotógrafo que invitas es aprobado y completa un trabajo pagado.",
      "loadError": "No se pudieron cargar tus referidos",
      "retry": "Reintentar",
      "addCode": "Añadir un código de referido",
      "addCodeHelp": "Introduce el código o enlace del fotógrafo que te refirió.",
      "confirmTitle": "Confirma a tu referidor",
      "referredBy": "Referido por {name}",
      "confirmWarning": "Esto no se podrá cambiar después.",
      "confirm": "Confirmar",
      "cancel": "Cancelar",
      "saved": "Código de referido guardado",
      "shareMessage": "Únete a mí en Connekyt. Usa mi código de referido {code}: {link}",
      "cardTitle": "Compartir e invitar",
      "chipAlbum": "Álbum",
      "chipProfile": "Perfil",
      "chipReferral": "Referido",
      "badgeLower": "Comisión menor",
      "badgeFee": "Tu comisión: {fee} %",
      "subAlbum": "Envía un enlace de álbum a tus clientes",
      "subReferral": "Invita fotógrafos, reduce tu comisión"
    },
    "policy": {
      "title": "Programa de referidos para fotógrafos de Connekyt",
      "updated": "Última actualización: noviembre de 2026",
      "intro": "Refiere a otros fotógrafos a Connekyt y reduce tu comisión de plataforma a medida que empiecen a ganar.",
      "tableTitle": "Tabla de comisiones",
      "colRefs": "Referidos calificados",
      "colFee": "Tu comisión de plataforma",
      "rowDefault": "0 a 4",
      "rowDefaultFee": "Tu comisión habitual",
      "rowFive": "5",
      "rowStep": "6 a 19",
      "rowStepFee": "30 % menos 1 punto por referido (24 % con 6, hasta 11 % con 19)",
      "rowMax": "20 (máximo)",
      "sections": [
        {
          "h": "Quién puede participar",
          "p": [
            "El programa está abierto a fotógrafos de Connekyt con el perfil aceptado y activo. Cada fotógrafo elegible recibe un código único de 8 caracteres y un enlace: connekyt.com/join?ref=TUCODIGO."
          ]
        },
        {
          "h": "Cómo referir",
          "p": [
            "Comparte tu código o enlace desde el menú Compartir de tu pantalla de inicio. Un fotógrafo nuevo puede introducirlo al registrarse (es opcional). Un fotógrafo existente sin referidor puede añadir un código en Perfil, Ajustes, Añadir un código de referido."
          ]
        },
        {
          "h": "Fotógrafos nuevos y existentes",
          "p": [
            "Cada cuenta puede tener un solo referidor. Se fija una vez y nunca se puede cambiar. No puedes referirte a ti mismo y dos fotógrafos no pueden referirse entre sí."
          ]
        },
        {
          "h": "Cuándo cuenta un referido",
          "p": [
            "Un referido califica cuando el fotógrafo referido es aceptado y completa un trabajo pagado (una reserva, una venta de fotos o álbum, una entrada de transmisión en vivo o un regalo) liquidado después de registrar el referido, de un cliente real y de al menos 5 USD. Para fotógrafos existentes, los pagos anteriores a añadir el código nunca cuentan.",
            "Hasta entonces el referido está pendiente. Un pago reembolsado o con contracargo nunca califica y el referido vuelve a pendiente."
          ]
        },
        {
          "h": "Tu comisión",
          "p": [
            "Tu comisión de plataforma depende de tus referidos calificados, según la tabla anterior. Se aplica a tus reservas, ventas de fotos y álbumes, entradas de transmisión y regalos. Si alguna de tus comisiones ya es menor que la del programa, conservas la menor."
          ]
        },
        {
          "h": "El límite de 20 referidos",
          "p": [
            "El máximo es de 20 referidos calificados, que dan la comisión más baja, 10 %. Al alcanzarlo, tu código deja de aceptar nuevos referidos."
          ]
        },
        {
          "h": "Permanente y no retroactivo",
          "p": [
            "Una tarifa ganada no vuelve a subir, aunque un referido se vaya después. La nueva tarifa se aplica a las transacciones desde el momento en que un referido califica y nunca cambia las transacciones pasadas. La única excepción es un referido que Connekyt revoque por fraude."
          ]
        },
        {
          "h": "Controles antifraude y revisión",
          "p": [
            "Revisamos cada referido por autorreferencia, teléfonos, correos, cuentas de pago, dispositivos o datos de identidad compartidos, pagos del mismo cliente a ambos, ráfagas inusuales de registros y referidos circulares. Un referido sospechoso queda en revisión y no cuenta hasta que nuestro equipo lo apruebe. Cuando revocamos un referido, tu tarifa se recalcula desde ese momento, no hacia atrás."
          ]
        },
        {
          "h": "Cambios en el programa",
          "p": [
            "Connekyt puede cambiar o terminar el programa para futuros referidos. Las tarifas ya ganadas se conservan."
          ]
        },
        {
          "h": "Contacto",
          "p": [
            "Preguntas sobre el programa: info@connekyt.com."
          ]
        }
      ]
    }
  } as unknown as ReferralStrings,
};

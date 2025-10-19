export type Language = 'lv' | 'en';

export interface Translations {
  landing: {
    title: string;
    description: string;
    premiumRequired: string;
    connectSpotify: string;
    poweredBy: string;
    limitedAvailability: string;
    limitText: string;
    joinWaitlist: string;
    limitTextLoggedIn: string;
    joinWaitlistUpdates: string;
  };
  lobby: {
    partyNickname: string;
    enterYourName: string;
    maxPlayers: string;
    players: string;
    createLobby: string;
    creatingLobby: string;
    shareInfo: string;
    welcome: string;
    hostingParty: string;
  };
  waitlist: {
    title: string;
    limitedAvailability: string;
    limitDescription: string;
    joinDescription: string;
    enterEmail: string;
    privacyTitle: string;
    privacyNotify: string;
    privacySecure: string;
    privacyDelete: string;
    privacyContact: string;
    consentText: string;
    joining: string;
    joinWaitlist: string;
    successTitle: string;
    successMessage: string;
  };
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    close: string;
    save: string;
    delete: string;
  };
}

export const translations: Record<Language, Translations> = {
  lv: {
    landing: {
      title: 'DJ, uzliec šito!',
      description: 'Izveidojiet kopīgu Spotify dziesmu sarakstu pasākumam un klausoties miniet, kurš ko pievienoja! Iepazīsti draugus labāk caur mūziku! Pazūd, kad ballīte beidzas. Nav digitālās pēdas, tikai atmiņas!',
      premiumRequired: 'Nepieciešams Premium Spotify konts, lai izveidotu ballīti',
      connectSpotify: 'Pieslēgties caur Spotify',
      poweredBy: 'Powered by Spotify',
      limitedAvailability: '⚠️ Ierobežota pieejamība:',
      limitText: 'Spotify ierobežojumu dēļ mēs varam atbalstīt tikai nelielu skaitu lietotāju, kas var izveidot ballīti. Ballītei var pievienoties bez Spotify konta!',
      joinWaitlist: 'Pievienoties Gaidīšanas Sarakstam',
      limitTextLoggedIn: 'Spotify ierobežojumu dēļ mēs varam atbalstīt tikai nelielu skaitu lietotāju, kas var izveidot ballīti. Pārējie dalībnieki var pievienoties bez Spotify konta!',
      joinWaitlistUpdates: 'Pievienoties Gaidīšanas Sarakstam Atjauninājumiem',
    },
    lobby: {
      partyNickname: 'Tava ballītes Iesauka',
      enterYourName: 'Ievadi savu vārdu',
      maxPlayers: 'Maksimālais Spēlētāju Skaits',
      players: 'Spēlētāji',
      createLobby: 'Izveidot Istabu',
      creatingLobby: 'Izveido Istabu...',
      shareInfo: 'Pēc izveidošanas, tu saņemsi saiti, lai ballītes dalībnieki varētu pievienoties',
      welcome: 'Sveicināts',
      hostingParty: 'Tu būsi šīs ballītes saimnieks',
    },
    waitlist: {
      title: 'Pievienoties Gaidīšanas Sarakstam',
      limitedAvailability: '⚠️ Ierobežota Pieejamība',
      limitDescription: 'Spotify ierobežojumu dēļ mēs varam atbalstīt tikai nelielu skaitu lietotāju, kas var izveidot ballīti. Pārējie dalībnieki ar pievienoties bez Spotify konta!',
      joinDescription: 'Pievienojies mūsu gaidīšanas sarakstam un mēs paziņosim, kad piekļuve tiks iedota',
      enterEmail: 'Ievadi savu e-pastu',
      privacyTitle: 'Privātuma Politika',
      privacyNotify: 'Mēs izmantosim tavu e-pastu tikai, lai paziņotu tev, kad tiks sniegta piekļuve',
      privacySecure: 'Tavs e-pasts tiek glabāts droši un nekad netiek kopīgots ar trešajām pusēm',
      privacyDelete: 'Mēs dzēsīsim tavus datus pēc tam, kad tiks sniegta piekļuve, vai pēc tava pieprasījuma',
      privacyContact: 'Lai pieprasītu dzēšanu, sazinies ar mums:',
      consentText: 'Es piekrītu, ka mans e-pasts tiek saglabāts, lai saņemtu paziņojumus, kad piekļuve būs pieejama. Es saprotu, ka varu pieprasīt e-pasta dzēšanu jebkurā laikā.',
      joining: 'Pievienojas...',
      joinWaitlist: 'Pievienoties Gaidīšanas Sarakstam',
      successTitle: 'Tu esi sarakstā!',
      successMessage: 'Mēs nosūtīsim tev e-pastu, kad tiks sniegta piekļuve.',
    },
    common: {
      loading: 'Ielādē...',
      error: 'Kļūda',
      success: 'Veiksmīgi',
      cancel: 'Atcelt',
      close: 'Aizvērt',
      save: 'Saglabāt',
      delete: 'Dzēst',
    },
  },
  en: {
    landing: {
      title: 'Pass the aux, share the vibe!',
      description: 'Build a collaborative playlist and guess who added what! Drop hints, leave comments, and discover your friends\' music secrets! Gone when the party ends. No digital footprint, just memories!',
      premiumRequired: 'You need a Premium Spotify account to host a party',
      connectSpotify: 'Connect Spotify Account',
      poweredBy: 'Powered by Spotify',
      limitedAvailability: '⚠️ Limited Availability:',
      limitText: 'Due to Spotify restrictions, we can only support a limited number of users at a time. The other participants can join without a Spotify acccount!',
      joinWaitlist: 'Join Waitlist',
      limitTextLoggedIn: 'Due to Spotify restrictions, we can only support a limited number of users at a time. If you encounter issues, we may be at capacity.',
      joinWaitlistUpdates: 'Join Waitlist for Updates',
    },
    lobby: {
      partyNickname: 'Your Party Nickname',
      enterYourName: 'Enter your name',
      maxPlayers: 'Maximum Players',
      players: 'Players',
      createLobby: 'Create Lobby',
      creatingLobby: 'Creating Lobby...',
      shareInfo: 'Once created, you\'ll get a shareable link for players to join',
      welcome: 'Welcome',
      hostingParty: 'You\'ll be hosting this party',
    },
    waitlist: {
      title: 'Join the Waitlist',
      limitedAvailability: '⚠️ Limited Availability',
      limitDescription: 'Due to Spotify restrictions, we can only support limited number of authenticated users at a time. The other participants can join the parties without Spotify account!',
      joinDescription: 'Join our waitlist and we\'ll notify you when a access becomes available.',
      enterEmail: 'Enter your email',
      privacyTitle: 'Your Privacy',
      privacyNotify: 'We\'ll only use your email to notify you when a access becomes available',
      privacySecure: 'Your email is stored securely and never shared with third parties',
      privacyDelete: 'We\'ll delete your data after you\'re notified or upon your request',
      privacyContact: 'To request deletion, contact us at:',
      consentText: 'I consent to my email being stored to receive notifications when access becomes available. I understand I can request deletion at any time.',
      joining: 'Joining...',
      joinWaitlist: 'Join Waitlist',
      successTitle: 'You\'re on the list!',
      successMessage: 'We\'ll email you when a host slot is available.',
    },
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      close: 'Close',
      save: 'Save',
      delete: 'Delete',
    },
  },
};


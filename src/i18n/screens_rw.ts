/**
 * Exact Kinyarwanda (`rw` — Ikinyarwanda) translations for screen-level `I18N.en`
 * dictionaries across:
 *  1. `src/app/(app)/content-album/new.tsx` (`NCA_I18N.en`)
 *  2. `src/app/(app)/content-albums.tsx` (`CA_I18N.en`)
 *  3. `src/app/(app)/photobooks.tsx` (`I18N.en`)
 *  4. `src/app/(app)/photobook/new.tsx` (`I18N.en`)
 *  5. `src/app/(app)/photobook/[id].tsx` (`I18N.en`)
 *  6. `src/app/(app)/collaborate/index.tsx` (`COLLAB_I18N.en`)
 *  7. `src/app/(app)/collaborate/join/[token].tsx` (`JOIN_INV_I18N.en`)
 *  8. `src/app/(app)/collaborate/album/[id].tsx` (`OA_I18N.en`)
 *  9. `src/app/(app)/collaborate/joined/[id].tsx` (`JA_I18N.en`)
 * 10. `src/app/(app)/event/geo-pricing.tsx` (`I18N.en`)
 */

export const SCREENS_RW_BY_TEXT: Record<string, string> = {
  // 1. src/app/(app)/content-album/new.tsx (NCA_I18N.en)
  'Please enter an album title': 'Andika umutwe wa alubumu',
  'Enter a numeric price': 'Andika igiciro mu mibare',
  'Price must be at least 100': 'Igiciro kigomba kuba nibura 100',
  'Please choose a category': 'Hitamo icyiciro',
  'Please select a currency': 'Hitamo ifaranga',
  'Please add at least one photo': 'Ongeramo nibura ifoto imwe',
  'Could not create album. Please try again.': 'Ntibyashobotse gukora alubumu. Ongera ugerageze.',
  'Back': 'Subira inyuma',
  'STOCK CATALOG': 'URUTONDE RW’AMAFOTO AGURISHWA',
  'New Content Album': 'Alubumu Nshya y’Amafoto Agurishwa',
  'Saved as a ': 'Bibitswe nk’',
  'draft': 'agateganyo',
  ". Submit it for review from the album viewer to publish to Connekt's public stock catalog.":
    '. Yikoreze isuzumwa uciye aho barebera alubumu kugira ngo ishyirwe ku isoko rusange rya Connekt.',
  'COLLECTION DETAILS': 'AMAKURU Y’ICYegeranyo',
  'ALBUM TITLE': 'UMUTWE WA ALUBUMU',
  'e.g. Diplomatic Reception, Kigali 2026': 'urugero: Umushyikirano w’Abadipolomate, Kigali 2026',
  'DESCRIPTION (OPTIONAL)': 'IBISOBANURO (SI NGOMBWA)',
  'Caption-style summary for public browsers and stock buyers…':
    'Incamake isobanurira abasura n’abaguzi b’amafoto…',
  'CATEGORY': 'ICYICIRO',
  'COMMERCIAL PRICING': 'IBICIRO BY’UBUCURUZI',
  'PRICE PER PHOTO': 'IGICIRO KURI BURI FOTO',
  'e.g. 500': 'urugero: 500',
  'CURRENCY': 'IFARANGA',
  'COVER PHOTO (OPTIONAL)': 'IFOTO Y’IGIFUNIKO (SI NGOMBWA)',
  'Tap to select a custom cover photo (or falls back to first photo)':
    'Kanda uhitemo ifoto y’igifuniko (bitaba ibyo hagakoreshwa ifoto ya mbere)',
  'STOCK PHOTOS': 'AMAFOTO AGURISHWA',
  '{count} photos': 'Amafoto {count}',
  'Add more stock photos': 'Ongeramo andi mafoto agurishwa',
  'Select photos from library': 'Hitamo amafoto mu bubiko',
  '{count} photos ready for review': 'Amafoto {count} yiteguye gusuzumwa',
  'High-resolution images will be submitted for commercial stock catalog.':
    'Amafoto afite ireme ryo hejuru azoherezwa mu rutonde rw’amafoto y’ubucuruzi.',
  'Ready to upload': 'Yiteguye koherezwa',
  'Clear all': 'Siba byose',
  'Remove photo': 'Kuraho ifoto',
  'Cancel': 'Hagarika',
  'Create Draft Album': 'Kora Alubumu y’Agateganyo',

  // 2. src/app/(app)/content-albums.tsx (CA_I18N.en)
  'Draft': 'Agateganyo',
  'In Review': 'Irasuzumwa',
  'Live · Approved': 'Iragaragara · Yemejwe',
  'Needs Changes': 'Ikeneye Impinduka',
  'All': 'Zose',
  'Drafts': 'Agateganyo',
  'Live': 'Iziriho',
  'STOCK & COMMERCIAL': 'AMAFOTO AGURISHWA N’AY’UBUCURUZI',
  'Content Albums': 'Alubumu z’Amafoto Agurishwa',
  'Search stock collections by title or tag…': 'Shakisha ibyegeranyo ukoresheje umutwe cyangwa akamenyetso…',
  'Stock Library': 'Ububiko bw’Amafoto Agurishwa',
  'Loading stock albums…': 'Gufungura alubumu z’amafoto agurishwa…',
  "Couldn't load content albums": 'Ntibyashobotse gufungura alubumu z’amafoto agurishwa',
  'Please check your network connection and pull down to retry.':
    'enzura murandasi yawe hanyuma ukurure umanura kugira ngo wongere ugerageze.',
  'Retry': 'Ongera ugerageze',
  'No matching content albums': 'Nta alubumu z’amafoto agurishwa zihuye n’ibyo ushakisha',
  'No content albums yet': 'Nta alubumu z’amafoto agurishwa zirahari',
  'Try selecting a different approval status or clearing your search.':
    'Gerageza guhitamo indi mimerere y’iyemezwa cyangwa usibe ibyo washakishije.',
  "Publish high-resolution stock photos to monetize them in Connekt's public catalog.":
    'Tangaza amafoto afite ireme ryo hejuru kugira ngo uyabyaze umusaruro mu isoko rusange rya Connekt.',
  'New content album': 'Alubumu nshya y’amafoto agurishwa',

  // 3. src/app/(app)/photobooks.tsx (I18N.en)
  'CURATED COLLECTIONS': 'IBYEGERANYO BYATORANYIJWE',
  'Photobooks': 'Ibitabo by’amafoto',
  'All Books': 'Ibitabo byose',
  'Published': 'Byatangajwe',
  'Delivered': 'Byatanzwe',
  'Pending': 'Bitegereje',
  'Book': 'Igitabo',
  'Search photobooks by title or client…': 'Shakisha ibitabo by’amafoto ku mutwe cyangwa umukiriya…',
  'Event Collection': 'Icyegeranyo cy’igikorwa',
  'Loading photobooks…': 'Gufungura ibitabo by’amafoto…',
  "Couldn't load photobooks": 'Ntibyashobotse gufungura ibitabo by’amafoto',
  'No matching photobooks': 'Nta bitabo by’amafoto bihuye n’ibyo ushakisha',
  'No photobooks yet': 'Nta bitabo by’amafoto birahari',
  'Try selecting a different status filter or clearing your search.':
    'Gerageza guhitamo akandi kayunguruzo k’imimerere cyangwa usibe ibyo washakishije.',
  'Curate your event photos into a bound, high-impact digital photobook.':
    'Toranya amafoto y’igikorwa cyawe uyakorere igitabo cy’amafoto cyiza kandi kibereye ijisho.',
  'Curated photobooks created by your photographer will appear here.':
    'Ibitabo by’amafoto byatoranyijwe kandi bigakorwa na gafotozi wawe bizagaragara hano.',
  'Create Photobook': 'Kora Igitabo cy’Amafoto',
  'New Photobook': 'Igitabo Gishya cy’Amafoto',
  'New photobook': 'Igitabo gishya cy’amafoto',

  // 4. src/app/(app)/photobook/new.tsx (I18N.en)
  'CURATED COLLECTION': 'ICYEGERANYO CYATORANYIJWE',
  'BOOK DETAILS': 'AMAKURU Y’IGITABO',
  'PHOTOBOOK NAME': 'IZINA RY’IGITABO CY’AMAFOTO',
  'e.g. Diana & Eric Wedding Photobook': 'urugero: Igitabo cy’Amafoto y’Ubukwe bwa Diana & Eric',
  'COVER DESCRIPTION (OPTIONAL)': 'IBISOBANURO BY’IGIFUNIKO (SI NGOMBWA)',
  'A short editorial blurb that introduces this photobook…':
    'Incamake ngufi itangiza ikanasobanura iki gitabo cy’amafoto…',
  'COVER PHOTO URL (OPTIONAL)': 'URL Y’IFOTO Y’IGIFUNIKO (SI NGOMBWA)',
  'https://… (optional, defaults to first photo)':
    'https://… (si ngombwa, hakoreshwa ifoto ya mbere iyo nta yindi)',
  'LINKED EVENT (OPTIONAL)': 'IGIKORWA KIFATANYE (SI NGOMBWA)',
  'Change': 'Hindura',
  'Attach to an event booking (or keep standalone)…':
    'Gifatanishe n’igikorwa cyafashwe (cyangwa ukireke ukwacyo)…',
  'PAGE LAYOUT STYLE': 'IMITERERE Y’IMikorerwe Y’IPAJI',
  'Classic Grid': 'Urusobe Rusanzwe',
  'Even 3-column grid with balanced borders': 'Urusobe rw’inkingi 3 zingana n’imbibi ziringaniye',
  'Editorial Magazine': 'Ikinyamakuru Ntangazamakuru',
  'Mixed portrait and landscape magazine spread': 'Ipaji z’ikinyamakuru zivanga amafoto ahagaze n’arambuye',
  'Story Flow': 'Uruhererekane rw’Inkuru',
  'Full-bleed vertical narrative scroll': 'Amafoto akurikirana ahagaze yuzuye ipaji nk’inkuru',
  'CURATED PHOTO MEDIA IDS': 'INDANGAMAFOTO (MEDIA IDS) ZATORANYIJWE',
  'MEDIA IDS (PASTE FROM ALBUM)': 'INDANGAMAFOTO (OMeka UVANYE MURI ALUBUMU)',
  'Paste photo UUIDs separated by commas or new lines…':
    'Omeka UUID z’amafoto uzitandukanyije n’aheke (comma) cyangwa umurongo mushya…',
  'Copy media IDs from an uploaded event album to include high-resolution photos in this photobook.':
    'Koporora indangamafoto (media IDs) muri alubumu y’igikorwa yoherejwe kugira ngo ushyiremo amafoto afite ireme ryo hejuru muri iki gitabo.',
  'Link Event': 'Huza n’Igikorwa',
  'Standalone Photobook': 'Igitabo cy’Amafoto Cyo Kwacyo',
  'Not attached to an event booking': 'Ntikifatanije n’igikorwa cyafashwe',
  'Search events by title or client…': 'Shakisha ibirori ku mutwe cyangwa umukiriya…',
  'No events matching search.': 'Nta birori bihuye n’ibyo ushakisha.',
  'Please provide a name for this photobook.': 'Andika izina ry’iki gitabo cy’amafoto.',
  'Add at least one photo media ID to curate into this photobook.':
    'Ongeramo nibura indangamafoto (media ID) imwe ishyirwa muri iki gitabo cy’amafoto.',
  'Could not create the photobook. Please try again.':
    'Ntibyashobotse gukora igitabo cy’amafoto. Ongera ugerageze.',

  // 5. src/app/(app)/photobook/[id].tsx (I18N.en)
  'Published · Live': 'Cyatangajwe · Kiragaragara',
  'Pending review': 'Gitegereje gusuzumwa',
  'Photobook': 'Igitabo cy’amafoto',
  'Photo': 'Ifoto',
  'Photo successfully saved to your camera roll.': 'Ifoto yabitswe neza mu bubiko bwa telefoni yawe.',
  'Save failed': 'Kubika byanze',
  'Could not save': 'Ntibyashobotse kubika',
  'Please try again.': 'Ongera ugerageze.',
  'Loading photobook…': 'Gufungura igitabo cy’amafoto…',
  "Couldn't load photobook": 'Ntibyashobotse gufungura igitabo cy’amafoto',
  'Curated Photobook': 'Igitabo cy’Amafoto Cyatoranyijwe',
  'Share photobook': 'Sangiza igitabo cy’amafoto',
  'PHOTOBOOK': 'IGITABO CY’AMAFOTO',
  'Extra Photos Available': 'Andi Mafoto Araboneka',
  'Pay & Unlock': 'Ishyura ufungure',
  'CURATED SPREADS': 'AMAPAJI YATORANYIJWE',
  '3-column dense view': 'Imigaragarire y’inkingi 3 zegeranye',
  '2-column editorial view': 'Imigaragarire y’inkingi 2 nini',
  'No photos in this book': 'Nta mafoto ari muri iki gitabo',
  'The photographer has not added photos to this photobook collection yet.':
    'Gafotozi ntarongeramo amafoto muri iki gitabo cy’amafoto.',
  'Close photo viewer': 'Funga aho barebera ifoto',
  'Share photo': 'Sangiza ifoto',
  'Previous photo': 'Ifoto ibanza',
  'Next photo': 'Ifoto ikurikira',
  'Save to Camera Roll': 'Bika muri Telefoni',
  'Photobook extras': 'Amafoto y’inyongera y’igitabo',
  'Extra photos': 'Amafoto y’inyongera',

  // 6. src/app/(app)/collaborate/index.tsx (COLLAB_I18N.en)
  'Could not load your albums.': 'Ntibyashobotse gufungura alubumu zawe.',
  'Could not load your albums': 'Ntibyashobotse gufungura alubumu zawe',
  'Try again': 'Ongera ugerageze',
  'COLLABORATE': 'GUFATANYA',
  'Work on albums together': 'Mukorere hamwe kuri alubumu',
  'Invite fellow photographers to an album. They submit photos, and you choose what goes in.':
    'Tumira bagenzi bawe b’abafotozi kuri alubumu. Boohereza amafoto, maze ugahitamo ajyamo.',
  'to review': 'yo gusuzuma',
  'collaborator': 'umufatanyabikorwa',
  'collaborators': 'abafatanyabikorwa',
  'joined': 'yinjiriye',
  'Paste the invite link you received': 'Omeka ihuza ry’ubutumire wakiriye',
  'Invite link': 'Ihuza ry’ubutumire',
  'Continue': 'Komeza',
  'Join an album with an invite link': 'Injira muri alubumu ukoresheje ihuza ry’ubutumire',
  'Join an album with a link': 'Injira muri alubumu ukoresheje ihuza',
  'My albums ({count})': 'Alubumu zanjye ({count})',
  'Joined ({count})': 'Izo ninjiriyemo ({count})',
  'You have no albums yet': 'Nta alubumu uragira',
  'Create an album first. Then open it here to invite photographers.':
    'Banza ukore alubumu. Hanyuma uyifungurire hano utumire abafotozi.',
  'Go to Gallery': 'Jya mu Bubiko bw’Amafoto',
  'No collaborators': 'Nta bafatanyabikorwa',
  'You have not joined any albums': 'Nta alubumu n’imwe urinjiramo',
  'When a photographer sends you an invite link, open it or paste it above to start submitting photos.':
    'Iyo gafotozi akoherereje ihuza ry’ubutumire, rifungure cyangwa uryomeke haruguru utangire kohereza amafoto.',
  'Paste a link': 'Omeka ihuza',
  'Album owner': 'Nyiri alubumu',
  '{count} waiting': '{count} ategereje',
  '{count} added': '{count} yongewemo',
  '{count} not accepted': '{count} ntiyemewe',

  // 7. src/app/(app)/collaborate/join/[token].tsx (JOIN_INV_I18N.en)
  'This is your own album': 'Iyi ni alubumu yawe bwite',
  'Send this link to the photographers you want to invite. Any number of them can join with it.':
    'Oherereza iri huza abafotozi ushaka gutumira. Umubare wose wabo ushobora kwinjira arikoresheje.',
  'You were removed from this album': 'Wakuwe muri iyi alubumu',
  'The album owner removed you after this link was made. Ask them for a new link to rejoin.':
    'Nyiri alubumu yagukuyemo nyuma y’uko iri huza rikorwa. Musabe ihuza rishya kugira ngo wongere winjire.',
  'This link was cancelled': 'Iri huza ryahagaritswe',
  'The album owner cancelled it. Ask them for a new one if you should still join.':
    'Nyiri alubumu yarihagaritse. Musabe irishya niba ugomba kwinjira.',
  'This link has expired': 'Iri huza ryarangiye igihe',
  'Invite links last 14 days. Ask the album owner for a new one.':
    'Amahuza y’ubutumire amara iminsi 14. Saba nyiri alubumu aguhe irishya.',
  'This invite link is not valid.': 'Iri huza ry’ubutumire ntiryemewe.',
  'Could not join this album.': 'Ntibyashobotse kwinjira muri iyi alubumu.',
  'Go to Collaborate': 'Jya mu Gufatanya',
  'This invite link does not work': 'Iri huza ry’ubutumire ntirikora',
  'invited you to collaborate on this album': 'yagutumiye gufatanya kuri iyi alubumu',
  'You can submit your photos to this album.': 'Ushobora kohereza amafoto yawe muri iyi alubumu.',
  '{name} reviews each one and decides what is added.': '{name} asuzuma buri foto akanemeza izongerwamo.',
  'You do not get access to their account, clients or earnings, and they do not get access to yours.':
    'Ntabwo ubona uburenganzira kuri konti ye, abakiriya be cyangwa amafaranga yinjiza, kandi na we ntabona uburenganzira ku byawe.',
  'Open album': 'Fungura alubumu',
  'Join album': 'Injira muri alubumu',

  // 8. src/app/(app)/collaborate/album/[id].tsx (OA_I18N.en)
  'Could not load this album.': 'Ntibyashobotse gufungura iyi alubumu.',
  'Could not open this album': 'Ntibyashobotse gufungura iyi alubumu',
  'Some photos stayed in review': 'Amafoto amwe yagumye mu isuzuma',
  '{count} photo(s) were already published by another photographer, so they could not be added. You can reject them instead.':
    'Amafoto {count} yari yamaze gutangazwa n’undi gafotozi, bityo ntiyashoboye kongerwamo. Ushobora kuyanga.',
  'Could not save your decision': 'Ntibyashobotse kubika icyemezo cyawe',
  'Join my album "{title}" on Connekyt and submit your photos: {link}':
    'Injira muri alubumu yanjye "{title}" kuri Connekyt uhereze amafoto yawe: {link}',
  'Could not create the invite link': 'Ntibyashobotse gukora ihuza ry’ubutumire',
  'Keep': 'Bika',
  'Could not update collaborators': 'Ntibyashobotse kuvugurura abafatanyabikorwa',
  'Remove {name}?': 'Kuraho {name}?',
  'They will no longer be able to submit photos to this album. Photos they already submitted stay in your review queue. To bring them back, send them a new link.':
    'Ntazongera gushobora kohereza amafoto muri iyi alubumu. Amafoto yamaze kohereza aguma ku rutonde rw’ayasuzumwa. Kugira ngo umugarure, mwoherereze ihuza rishya.',
  'Remove': 'Kuraho',
  'YOUR ALBUM': 'ALUBUMU YAWE',
  '{photos} photos · {collabs} collaborator(s)': 'Amafoto {photos} · Abafatanyabikorwa {collabs}',
  'Invite a photographer': 'Tumira gafotozi',
  'Review ({count})': 'Suzuma ({count})',
  'People ({count})': 'Abantu ({count})',
  'History': 'Amateka',
  'Nothing to review': 'Nta kintu cyo gusuzuma',
  'Invite a photographer. Photos they submit will wait here for your decision.':
    'Tumira gafotozi. Amafoto azohereza azategerereza hano icyemezo cyawe.',
  'You are all caught up. New photos from your collaborators will appear here.':
    'nta gisigaye cyo gusuzuma. Amafoto mashya y’abafatanyabikorwa bawe azagaragara hano.',
  '{count} selected': '{count} yatoranyijwe',
  'Tap to review · long press to select': 'Kanda usuzume · kanda utinde kugira ngo utoranye',
  'Clear': 'Siba',
  'Select all': 'Toranya byose',
  'Collaborators': 'Abafatanyabikorwa',
  'No one yet. Create an invite link and send it to a photographer you work with.':
    'Nta wari winjira. Kora ihuza ry’ubutumire uryoherereze gafotozi mukorana.',
  'Joined {ago} · {count} photos': 'Yinjiye {ago} · amafoto {count}',
  'Open invite links': 'Amahuza y’ubutumire akora',
  'None. One link can bring in as many photographers as you send it to.':
    'Nta rihari. Ihuza rimwe rishobora kwinjiza abafotozi bose uryoherereje.',
  '{count} joined · {left}': '{count} binjiye · {left}',
  'Share': 'Sangiza',
  'Cancel this link?': 'Hagarika iri huza?',
  'Nobody else can join with it. Photographers who already joined stay.':
    'Nta wundi ushobora kwinjira arikoresheje. Abafotozi bamaze kwinjira baraguma.',
  'Cancel link': 'Hagarika ihuza',
  'No decisions yet': 'Nta byemezo birafatwa',
  'Photos you approve or reject are listed here.': 'Amafoto wemeje cyangwa wanze agaragara hano.',
  'Reject': 'Anga',
  'Add {count}': 'Ongeramo {count}',
  'Close': 'Funga',
  'Submitted {ago}': 'Yoherejwe {ago}',
  'Add to album': 'Ongeramo kuri alubumu',
  'Your note: {note}': 'Icyo wanditse: {note}',
  'Reject {count} photo(s)?': 'Wange amafoto {count}?',
  'They stay out of the album. The photographer is told, with your note if you add one.':
    'Ntabwo yongerwa muri alubumu. Gafotozi arabimenyeshwa, hamwe n’ubutumwa bwawe niba ubushyizemo.',
  'Note for the photographer (optional)': 'Ubutumwa bugenewe gafotozi (si ngombwa)',

  // 9. src/app/(app)/collaborate/joined/[id].tsx (JA_I18N.en)
  'Waiting': 'Ategereje',
  'Added': 'Yongewemo',
  'Not accepted': 'Ntiyemewe',
  '{count} photo(s) left out': 'Amafoto {count} yasizwe inyuma',
  'Upload failed': 'Kohereza byanze',
  '{count} photo(s) not submitted': 'Amafoto {count} ntiyoherejwe',
  'Withdraw this photo?': 'Kuraho iyi foto yoherejwe?',
  'It will be removed before the owner reviews it.': 'Izakurwaho mbere y’uko nyiri alubumu ayisuzuma.',
  'Withdraw': 'Kuraho',
  'Could not withdraw': 'Ntibyashobotse kuyikuraho',
  'Leave this album?': 'kuva muri iyi alubumu?',
  'You will no longer be able to submit photos to "{title}". Photos already added stay in the album. To come back, {owner} has to send you a new link.':
    'Ntuzongera gushobora kohereza amafoto muri "{title}". Amafoto yamaze kongerwamo aguma muri alubumu. Kugira ngo ugaruke, {owner} agomba kukoherereza ihuza rishya.',
  'Stay': 'Gumamo',
  'Leave': 'vamo',
  'Could not leave': 'Ntibyashobotse kuvamo',
  'You cannot open this album': 'Ntushobora gufungura iyi alubumu',
  'Back to Collaborate': 'Subira mu Gufatanya',
  'COLLABORATING': 'GUFATANYA',
  'Owns this album and reviews what you submit': 'Ni we nyiri iyi alubumu kandi asuzuma ibyo wohereza',
  'Submit your photos': 'Ohereza amafoto yawe',
  'Full quality. JPEG, PNG or WebP, up to 20 MB each, at least Full HD. Photos are only sent to {owner} when you tap Submit, and you can withdraw one until it is reviewed.':
    'Ireme ryuzuye. JPEG, PNG cyangwa WebP, kugeza kuri 20 MB kuri buri imwe, nibura Full HD. Amafoto yohererezwa {owner} gusa iyo ukanze Ohereza, kandi ushobora gukuraho ifoto mbere y’uko isuzumwa.',
  'Add more photos': 'Ongeramo andi mafoto',
  'Add photos': 'Ongeramo amafoto',
  '{count} photo(s) ready to submit': 'Amafoto {count} yiteguye koherezwa',
  'Submitting {current} of {total}…': 'Kohereza {current} muri {total}…',
  'Submit {count} photo(s) to {owner}': 'Oherereza {owner} amafoto {count}',
  '{done} submitted': '{done} yoherejwe',
  ' · {failed} failed': ' · {failed} byanze',
  '{count} photo(s) rejected': 'Amafoto {count} yanze',
  'Dismiss': 'Funga',
  'Nothing submitted yet': 'Nta foto iraherezwa',
  'Nothing here': 'Nta kintu kiri hano',
  'Photos you submit show up here with their review status.':
    'Amafoto wohereza agaragara hano hamwe n’aho isuzuma ryayo rigeze.',
  'No photos with this status.': 'Nta mafoto afite iyi mimerere.',
  'Leave album': 'Va muri alubumu',

  // 10. src/app/(app)/event/geo-pricing.tsx (I18N.en)
  'Geo pricing': 'Ibiciro bikurikije akarere',
  'Select Event to Price:': 'Hitamo Igikorwa Ushyiriraho Ibiciro:',
  'Charge different prices by location. A ': 'Shyiraho ibiciro bitandukanye ukurikije aho abantu baherereye. Igiciro cy’',
  'country': 'igihugu',
  ' price beats a ': 'kiruta icy’',
  'continent': 'umugabane',
  ' price, which beats your ': ', na cyo kikaruta igiciro cyawe ',
  'default': 'gisanzwe',
  '. Anywhere without a rule pays the default': '. Ahantu hose hatari amabwiriza hishyura igiciro gisanzwe',
  'Remove all': 'Kuraho byose',
  'No location prices yet. Everyone pays your default price.':
    'Nta biciro by’uturere birashyirwaho. Buri wese yishyura igiciro cyawe gisanzwe.',
  'Continent': 'Umugabane',
  'Country': 'Igihugu',
  'Add a location price': 'Ongeraho igiciro cy’akarere',
  'Continents': 'Imigabane',
  'Countries': 'Ibihugu',
  'Search continent or country (e.g. Africa, Rwanda, UK)...':
    'Shakisha umugabane cyangwa igihugu (urugero: Afurika, u Rwanda, UK)...',
  'Select all shown': 'Toranya byose bigaragara',
  'Cont': 'Umug',
  'Ctry': 'Igih',
  'Price': 'Igiciro',
  'Currency': 'Ifaranga',
  'Save Price': 'Bika Igiciro',
  'Pick at least one continent or country.': 'Hitamo nibura umugabane umwe cyangwa igihugu kimwe.',
  'Enter a valid price.': 'Andika igiciro cyemewe.',
  'Could not save the prices.': 'Ntibyashobotse kubika ibiciro.',
  'Remove all location prices?': 'Kuraho ibiciro byose by’uturere?',
  'Are you sure you want to remove all custom location prices? Viewers will pay the default stream price.':
    'Urifuza koko gukuraho ibiciro byose byihariye by’uturere? Abareba bazishyura igiciro gisanzwe cy’imbonankubone.',
  'Error': 'Ikosa',
  'Could not remove all location prices.': 'Ntibyashobotse gukuraho ibiciro byose by’uturere.',
  'Remove price': 'Kuraho igiciro',
  'Could not remove the price.': 'Ntibyashobotse gukuraho igiciro.',
};

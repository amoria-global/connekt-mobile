/**
 * Where a pasted invite link lands, mirrors the dashboard's
 * /user/photographer/collaborate/join/[token]. Shows whose album it is
 * and what joining means before the photographer commits.
 */
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { acceptInvite, previewInvite } from '@/features/collab/api';
import { AlbumCover, PersonRow } from '@/features/collab/components';
import type { InvitePreview } from '@/features/collab/model';
import { useLanguage } from '@/hooks/useLanguage';
import { isApiError } from '@/store/auth';
import { fontSize, fontWeight, fonts, radii, spacing, makeStyles, useTheme } from '@/theme';

const JOIN_INV_I18N = {
  en: {
    ownerTitle: 'This is your own album',
    ownerMsg: 'Send this link to the photographers you want to invite. Any number of them can join with it.',
    removedTitle: 'You were removed from this album',
    removedMsg: 'The album owner removed you after this link was made. Ask them for a new link to rejoin.',
    revokedTitle: 'This link was cancelled',
    revokedMsg: 'The album owner cancelled it. Ask them for a new one if you should still join.',
    expiredTitle: 'This link has expired',
    expiredMsg: 'Invite links last 14 days. Ask the album owner for a new one.',
    invalidLink: 'This invite link is not valid.',
    errJoin: 'Could not join this album.',
    goToCollab: 'Go to Collaborate',
    brokenTitle: 'This invite link does not work',
    invitedCaption: 'invited you to collaborate on this album',
    point1: 'You can submit your photos to this album.',
    point2: '{name} reviews each one and decides what is added.',
    point3: 'You do not get access to their account, clients or earnings, and they do not get access to yours.',
    openAlbum: 'Open album',
    joinAlbum: 'Join album',
  },
  fr: {
    ownerTitle: 'C’est votre propre album',
    ownerMsg: 'Envoyez ce lien aux photographes que vous souhaitez inviter. Ils peuvent tous rejoindre avec ce lien.',
    removedTitle: 'Vous avez été retiré de cet album',
    removedMsg: 'Le propriétaire de l’album vous a retiré après la création de ce lien. Demandez-lui un nouveau lien.',
    revokedTitle: 'Ce lien a été annulé',
    revokedMsg: 'Le propriétaire de l’album l’a annulé. Demandez-lui un nouveau lien.',
    expiredTitle: 'Ce lien a expiré',
    expiredMsg: 'Les liens d’invitation durent 14 jours. Demandez-en un nouveau au propriétaire de l’album.',
    invalidLink: 'Ce lien d’invitation n’est pas valide.',
    errJoin: 'Impossible de rejoindre cet album.',
    goToCollab: 'Aller à Collaborer',
    brokenTitle: 'Ce lien d’invitation ne fonctionne pas',
    invitedCaption: 'vous a invité à collaborer sur cet album',
    point1: 'Vous pouvez soumettre vos photos à cet album.',
    point2: '{name} examine chacune d’elles et décide de ce qui est ajouté.',
    point3: 'Vous n’avez pas accès à son compte, ses clients ou ses revenus, et inversement.',
    openAlbum: 'Ouvrir l’album',
    joinAlbum: 'Rejoindre l’album',
  },
  es: {
    ownerTitle: 'Este es tu propio álbum',
    ownerMsg: 'Envía este enlace a los fotógrafos que quieras invitar. Cualquiera puede unirse con él.',
    removedTitle: 'Fuiste eliminado de este álbum',
    removedMsg: 'El propietario del álbum te eliminó después de crear este enlace. Pídele un nuevo enlace.',
    revokedTitle: 'Este enlace fue cancelado',
    revokedMsg: 'El propietario del álbum lo canceló. Pídele uno nuevo si aún debes unirte.',
    expiredTitle: 'Este enlace ha caducado',
    expiredMsg: 'Los enlaces de invitación duran 14 días. Pídele uno nuevo al propietario del álbum.',
    invalidLink: 'Este enlace de invitación no es válido.',
    errJoin: 'No se pudo unir a este álbum.',
    goToCollab: 'Ir a Colaborar',
    brokenTitle: 'Este enlace de invitación no funciona',
    invitedCaption: 'te invitó a colaborar en este álbum',
    point1: 'Puedes enviar tus fotos a este álbum.',
    point2: '{name} revisa cada una y decide qué se añade.',
    point3: 'No tienes acceso a su cuenta, clientes ni ganancias, y tampoco tienen acceso a los tuyos.',
    openAlbum: 'Abrir álbum',
    joinAlbum: 'Unirse al álbum',
  },
} as const;

export default function JoinInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const { language } = useLanguage();
  const s = JOIN_INV_I18N[language] ?? JOIN_INV_I18N.en;
  // Everything below belongs to one token. State is keyed by it, so a new link can never show the previous album,
  // error or "joining" spinner, without resetting state inside an effect.
  const [loaded, setLoaded] = useState<{ token: string; preview: InvitePreview | null; error: string | null } | null>(null);
  const [joiningToken, setJoiningToken] = useState<string | null>(null);
  const here = loaded && loaded.token === token ? loaded : null;
  const preview = here?.preview ?? null;
  const error = here?.error ?? null;
  const joining = joiningToken === token;

  const BLOCKED: Record<string, { icon: 'person-outline' | 'person-remove-outline' | 'ban-outline' | 'time-outline'; title: string; message: string }> = {
    OWNER: { icon: 'person-outline', title: s.ownerTitle, message: s.ownerMsg },
    REMOVED: { icon: 'person-remove-outline', title: s.removedTitle, message: s.removedMsg },
    REVOKED: { icon: 'ban-outline', title: s.revokedTitle, message: s.revokedMsg },
    EXPIRED: { icon: 'time-outline', title: s.expiredTitle, message: s.expiredMsg },
  };

  useEffect(() => {
    if (!token) return;
    let current = true;
    previewInvite(token)
      .then((p) => current && setLoaded({ token, preview: p, error: null }))
      .catch(
        (e) =>
          current &&
          setLoaded({ token, preview: null, error: isApiError(e) ? e.message : s.invalidLink }),
      );
    return () => {
      current = false;
    };
  }, [token, s.invalidLink]);

  const join = async () => {
    if (!token) return;
    setJoiningToken(token);
    setLoaded((l) => (l && l.token === token ? { ...l, error: null } : l));
    try {
      const albumId = await acceptInvite(token);
      router.replace(`/collaborate/joined/${albumId}` as Href);
    } catch (e) {
      setLoaded((l) =>
        l && l.token === token ? { ...l, error: isApiError(e) ? e.message : s.errJoin } : l,
      );
      setJoiningToken(null);
    }
  };

  const back = { label: s.goToCollab, onPress: () => router.replace('/collaborate' as Href) };

  if (!preview) {
    return (
      <Screen padded={false}>
        {error ? (
          <EmptyState icon="link-outline" title={s.brokenTitle} message={error} action={back} />
        ) : (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        )}
      </Screen>
    );
  }

  const blocked = BLOCKED[preview.state];
  if (blocked) {
    return <Screen padded={false}><EmptyState icon={blocked.icon} title={blocked.title} message={blocked.message} action={back} /></Screen>;
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.cover}>
          <AlbumCover uri={preview.album.coverImage} title={preview.album.title} />
        </View>
        <Text style={styles.title}>{preview.album.title}</Text>
        <PersonRow person={preview.owner} caption={s.invitedCaption} />

        <View style={styles.points}>
          <Point icon="cloud-upload-outline" text={s.point1} />
          <Point icon="checkmark-done-outline" text={s.point2.replace('{name}', preview.owner.name)} />
          <Point icon="shield-checkmark-outline" text={s.point3} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {preview.state === 'ALREADY_MEMBER' ? (
          <Button title={s.openAlbum} onPress={() => router.replace(`/collaborate/joined/${preview.album.id}` as Href)} />
        ) : (
          <Button title={s.joinAlbum} onPress={join} loading={joining} />
        )}
      </ScrollView>
    </Screen>
  );
}

function Point({ icon, text }: { icon: 'cloud-upload-outline' | 'checkmark-done-outline' | 'shield-checkmark-outline'; text: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['3xl'] },
  cover: { height: 190, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  title: { color: c.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, fontFamily: fonts.bold },
  points: { gap: spacing.md, backgroundColor: c.tint, borderRadius: radii.lg, padding: spacing.lg },
  point: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  pointText: { flex: 1, color: c.text, fontSize: fontSize.sm, lineHeight: 20 },
  error: { color: c.error, fontSize: fontSize.sm },
}));
